import * as THREE from 'three';

/**
 * Ensure geometry has perfect symmetry by adding missing mirror vertices
 * This is needed after subdivision which might create asymmetric topology
 */
export function ensureGeometrySymmetry(
  geometry: THREE.BufferGeometry,
  symmetryAxes: { x: boolean; y: boolean; z: boolean },
  tolerance: number = 0.001
): THREE.BufferGeometry {
  if (!symmetryAxes.x && !symmetryAxes.y && !symmetryAxes.z) {
    return geometry;
  }

  const positions = geometry.getAttribute('position');
  const posArray = positions.array as Float32Array;

  const vertices: THREE.Vector3[] = [];
  for (let i = 0; i < positions.count; i++) {
    vertices.push(new THREE.Vector3(
      posArray[i * 3],
      posArray[i * 3 + 1],
      posArray[i * 3 + 2]
    ));
  }

  // Get existing indices
  let indices = geometry.getIndex();
  let indexArray: number[];

  if (indices) {
    indexArray = Array.from(indices.array);
  } else {
    indexArray = [];
    for (let i = 0; i < vertices.length; i += 3) {
      indexArray.push(i, i + 1, i + 2);
    }
  }

  // Find vertices that need mirrors
  const newVertices = [...vertices];
  const vertexToMirror = new Map<number, number>();  // original -> mirror index

  // For each existing vertex, check if it has a mirror
  for (let i = 0; i < vertices.length; i++) {
    if (vertexToMirror.has(i)) continue; // Already mapped

    const v = vertices[i];

    // Calculate expected mirror position
    const mirrorPos = v.clone();
    if (symmetryAxes.x) mirrorPos.x = -mirrorPos.x;
    if (symmetryAxes.y) mirrorPos.y = -mirrorPos.y;
    if (symmetryAxes.z) mirrorPos.z = -mirrorPos.z;

    // Check if vertex is on symmetry plane
    const onPlane =
      (!symmetryAxes.x || Math.abs(v.x) < tolerance) &&
      (!symmetryAxes.y || Math.abs(v.y) < tolerance) &&
      (!symmetryAxes.z || Math.abs(v.z) < tolerance);

    if (onPlane) {
      // Vertex is on symmetry plane, it's its own mirror
      vertexToMirror.set(i, i);
      continue;
    }

    // Look for existing mirror vertex
    let foundMirror = false;
    for (let j = i + 1; j < vertices.length; j++) {
      if (vertexToMirror.has(j)) continue;

      const vj = vertices[j];
      const dist = mirrorPos.distanceTo(vj);

      if (dist < tolerance) {
        vertexToMirror.set(i, j);
        vertexToMirror.set(j, i);
        foundMirror = true;
        break;
      }
    }

    // If no mirror found, create one
    if (!foundMirror) {
      const newIndex = newVertices.length;
      newVertices.push(mirrorPos);
      vertexToMirror.set(i, newIndex);
      vertexToMirror.set(newIndex, i);
    }
  }

  // If no new vertices were added, return original geometry
  if (newVertices.length === vertices.length) {
    return geometry;
  }

  // Create mirror triangles for any triangles that involve new vertices
  const newIndices = [...indexArray];
  const processedTriangles = new Set<string>();

  for (let i = 0; i < indexArray.length; i += 3) {
    const i0 = indexArray[i];
    const i1 = indexArray[i + 1];
    const i2 = indexArray[i + 2];

    // Get mirror indices
    const m0 = vertexToMirror.get(i0)!;
    const m1 = vertexToMirror.get(i1)!;
    const m2 = vertexToMirror.get(i2)!;

    // Check if this is a triangle that needs mirroring
    const needsMirror = m0 !== i0 || m1 !== i1 || m2 !== i2;

    if (needsMirror) {
      // Create mirror triangle with reversed winding order
      const mirrorKey = [m0, m1, m2].sort().join('-');

      if (!processedTriangles.has(mirrorKey)) {
        // Check if mirror triangle already exists
        let exists = false;
        for (let j = 0; j < newIndices.length; j += 3) {
          const j0 = newIndices[j];
          const j1 = newIndices[j + 1];
          const j2 = newIndices[j + 2];

          const triKey = [j0, j1, j2].sort().join('-');
          if (triKey === mirrorKey) {
            exists = true;
            break;
          }
        }

        if (!exists) {
          // Add mirror triangle with reversed winding
          newIndices.push(m0, m2, m1);
        }

        processedTriangles.add(mirrorKey);
      }
    }
  }

  // Create new geometry
  const newGeometry = new THREE.BufferGeometry();

  const newPosArray = new Float32Array(newVertices.length * 3);
  for (let i = 0; i < newVertices.length; i++) {
    newPosArray[i * 3] = newVertices[i].x;
    newPosArray[i * 3 + 1] = newVertices[i].y;
    newPosArray[i * 3 + 2] = newVertices[i].z;
  }

  newGeometry.setAttribute('position', new THREE.BufferAttribute(newPosArray, 3));
  newGeometry.setIndex(newIndices);

  newGeometry.computeVertexNormals();
  newGeometry.computeBoundingBox();
  newGeometry.computeBoundingSphere();

  return newGeometry;
}