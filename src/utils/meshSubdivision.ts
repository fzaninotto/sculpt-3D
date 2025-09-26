import * as THREE from 'three';

/**
 * Calculate the longest edge length of a triangle
 */
function getMaxEdgeLength(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): number {
  const edge1 = v1.distanceTo(v2);
  const edge2 = v2.distanceTo(v3);
  const edge3 = v3.distanceTo(v1);
  return Math.max(edge1, edge2, edge3);
}

/**
 * Check if a triangle needs subdivision based on its size
 */
export function triangleNeedsSubdivision(
  v1: THREE.Vector3,
  v2: THREE.Vector3,
  v3: THREE.Vector3,
  maxEdgeLength: number = 1.0
): boolean {
  return getMaxEdgeLength(v1, v2, v3) > maxEdgeLength;
}

/**
 * Subdivide geometry locally around a point
 */
export function subdivideGeometryLocally(
  geometry: THREE.BufferGeometry,
  point: THREE.Vector3,
  radius: number,
  maxEdgeLength: number = 0.5
): THREE.BufferGeometry {
  const positions = geometry.getAttribute('position');
  if (!positions) return geometry;

  const posArray = positions.array as Float32Array;
  const vertices: THREE.Vector3[] = [];

  // Convert positions to Vector3 array
  for (let i = 0; i < positions.count; i++) {
    vertices.push(new THREE.Vector3(
      posArray[i * 3],
      posArray[i * 3 + 1],
      posArray[i * 3 + 2]
    ));
  }

  // Get or create index
  let indices = geometry.getIndex();
  let indexArray: number[];

  if (indices) {
    indexArray = Array.from(indices.array);
  } else {
    // Create index from non-indexed geometry
    indexArray = [];
    for (let i = 0; i < vertices.length; i += 3) {
      indexArray.push(i, i + 1, i + 2);
    }
  }

  const newVertices = [...vertices];
  const newIndices: number[] = [];
  const edgeMidpoints = new Map<string, number>();

  // Helper function to get or create midpoint
  const getMidpoint = (i1: number, i2: number): number => {
    const key = i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;

    if (edgeMidpoints.has(key)) {
      return edgeMidpoints.get(key)!;
    }

    const v1 = vertices[i1];
    const v2 = vertices[i2];
    const midpoint = v1.clone().add(v2).multiplyScalar(0.5);

    const newIndex = newVertices.length;
    newVertices.push(midpoint);
    edgeMidpoints.set(key, newIndex);

    return newIndex;
  };

  let trianglesToSubdivide = 0;
  let trianglesProcessed = 0;

  // Process each triangle
  for (let i = 0; i < indexArray.length; i += 3) {
    const i0 = indexArray[i];
    const i1 = indexArray[i + 1];
    const i2 = indexArray[i + 2];

    const v0 = vertices[i0];
    const v1 = vertices[i1];
    const v2 = vertices[i2];

    // Calculate triangle center
    const center = v0.clone().add(v1).add(v2).multiplyScalar(1/3);
    const distToPoint = center.distanceTo(point);

    trianglesProcessed++;

    // Check if triangle is within subdivision radius and needs subdivision
    if (distToPoint < radius && triangleNeedsSubdivision(v0, v1, v2, maxEdgeLength)) {
      trianglesToSubdivide++;
      // Subdivide triangle into 4 smaller triangles
      const m01 = getMidpoint(i0, i1);
      const m12 = getMidpoint(i1, i2);
      const m20 = getMidpoint(i2, i0);

      // Add 4 new triangles
      newIndices.push(i0, m01, m20);
      newIndices.push(i1, m12, m01);
      newIndices.push(i2, m20, m12);
      newIndices.push(m01, m12, m20);
    } else {
      // Keep original triangle
      newIndices.push(i0, i1, i2);
    }
  }


  // Create new geometry with subdivided mesh
  const newGeometry = new THREE.BufferGeometry();

  // Set new positions
  const newPosArray = new Float32Array(newVertices.length * 3);
  for (let i = 0; i < newVertices.length; i++) {
    newPosArray[i * 3] = newVertices[i].x;
    newPosArray[i * 3 + 1] = newVertices[i].y;
    newPosArray[i * 3 + 2] = newVertices[i].z;
  }

  newGeometry.setAttribute('position', new THREE.BufferAttribute(newPosArray, 3));
  newGeometry.setIndex(newIndices);

  // Copy other attributes if they exist
  const normal = geometry.getAttribute('normal');
  if (normal) {
    newGeometry.computeVertexNormals();
  }

  const uv = geometry.getAttribute('uv');
  if (uv) {
    // For now, we'll skip UV interpolation (complex)
    // In production, you'd interpolate UVs for new vertices
  }

  newGeometry.computeBoundingBox();
  newGeometry.computeBoundingSphere();

  return newGeometry;
}

/**
 * Simple subdivision of entire geometry (for testing)
 */
export function subdivideGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  const positions = geometry.getAttribute('position');
  if (!positions) return geometry;

  const center = new THREE.Vector3();
  geometry.computeBoundingBox();
  if (geometry.boundingBox) {
    geometry.boundingBox.getCenter(center);
  }

  // Subdivide with a large radius to affect whole mesh
  return subdivideGeometryLocally(geometry, center, 1000, 0.5);
}