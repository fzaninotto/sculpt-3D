import * as THREE from 'three';

/**
 * Subdivide geometry around multiple points simultaneously to maintain symmetry
 * This ensures that when we subdivide symmetric regions, the topology stays symmetric
 */
export function subdivideSymmetrically(
  geometry: THREE.BufferGeometry,
  localPoints: THREE.Vector3[],
  localRadius: number,
  maxEdgeLength: number
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

  // Get index (geometry should already be properly indexed by PrimitiveFactory)
  // If not, merge vertices as fallback
  let indices = geometry.getIndex();
  let indexArray: number[];

  if (!indices) {
    // Fallback: merge vertices for geometries not created by PrimitiveFactory
    // This handles test cases and edge cases
    const epsilon = 0.001;
    const vertexMap = new Map<string, number>();
    const newIndices: number[] = [];
    const newVertices: THREE.Vector3[] = [];

    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const key = `${Math.round(v.x / epsilon)}_${Math.round(v.y / epsilon)}_${Math.round(v.z / epsilon)}`;

      let index = vertexMap.get(key);
      if (index === undefined) {
        index = newVertices.length;
        newVertices.push(v.clone());
        vertexMap.set(key, index);
      }
      newIndices.push(index);
    }

    // Update vertices and indexArray
    vertices.length = 0;
    vertices.push(...newVertices);
    indexArray = newIndices;
  } else {
    indexArray = Array.from(indices.array);
  }

  // Mark edges for subdivision - combine influence from ALL points
  const edgesToSubdivide = new Set<string>();

  for (let i = 0; i < indexArray.length; i += 3) {
    const i0 = indexArray[i];
    const i1 = indexArray[i + 1];
    const i2 = indexArray[i + 2];

    const v0 = vertices[i0];
    const v1 = vertices[i1];
    const v2 = vertices[i2];

    // Check each edge against ALL symmetry points
    const edges = [
      { key: makeEdgeKey(i0, i1), v1: v0, v2: v1 },
      { key: makeEdgeKey(i1, i2), v1: v1, v2: v2 },
      { key: makeEdgeKey(i2, i0), v1: v2, v2: v0 },
    ];

    for (const edge of edges) {
      const edgeLength = edge.v1.distanceTo(edge.v2);
      if (edgeLength <= maxEdgeLength * 1.5) continue;

      const edgeMid = edge.v1.clone().add(edge.v2).multiplyScalar(0.5);

      // Check if this edge is within radius of ANY symmetry point
      for (const point of localPoints) {
        const distance = edgeMid.distanceTo(point);
        if (distance < localRadius * 0.8) {
          edgesToSubdivide.add(edge.key);
          break;
        }
      }
    }
  }

  // Build edge adjacency
  const edgeToTriangles = buildEdgeAdjacency(indexArray);

  // Propagate subdivision to maintain quality
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 5) {
    changed = false;
    iterations++;

    const edgesToAdd = new Set<string>();

    for (const edge of edgesToSubdivide) {
      const triangles = edgeToTriangles.get(edge) || [];

      for (const triIdx of triangles) {
        const i = triIdx * 3;
        const i0 = indexArray[i];
        const i1 = indexArray[i + 1];
        const i2 = indexArray[i + 2];

        const edge01 = makeEdgeKey(i0, i1);
        const edge12 = makeEdgeKey(i1, i2);
        const edge20 = makeEdgeKey(i2, i0);

        let markedCount = 0;
        if (edgesToSubdivide.has(edge01)) markedCount++;
        if (edgesToSubdivide.has(edge12)) markedCount++;
        if (edgesToSubdivide.has(edge20)) markedCount++;

        // If 2 edges marked, mark the third for better quality
        if (markedCount === 2) {
          if (!edgesToSubdivide.has(edge01) && !edgesToAdd.has(edge01)) {
            edgesToAdd.add(edge01);
            changed = true;
          }
          if (!edgesToSubdivide.has(edge12) && !edgesToAdd.has(edge12)) {
            edgesToAdd.add(edge12);
            changed = true;
          }
          if (!edgesToSubdivide.has(edge20) && !edgesToAdd.has(edge20)) {
            edgesToAdd.add(edge20);
            changed = true;
          }
        }
      }
    }

    for (const edge of edgesToAdd) {
      edgesToSubdivide.add(edge);
    }
  }

  // If no edges to subdivide, return original
  if (edgesToSubdivide.size === 0) {
    return geometry;
  }

  // Create midpoints for marked edges
  const newVertices = [...vertices];
  const edgeMidpoints = new Map<string, number>();
  for (const edge of edgesToSubdivide) {
    const [i1, i2] = edge.split('-').map(Number);
    const v1 = vertices[i1];
    const v2 = vertices[i2];
    const midpoint = v1.clone().add(v2).multiplyScalar(0.5);

    // Project to sphere if vertices are roughly on sphere surface
    const v1Length = v1.length();
    const v2Length = v2.length();
    const avgLength = (v1Length + v2Length) * 0.5;

    if (Math.abs(v1Length - avgLength) < 0.3 && Math.abs(v2Length - avgLength) < 0.3) {
      midpoint.normalize().multiplyScalar(avgLength);
    }

    const newIndex = newVertices.length;
    newVertices.push(midpoint);
    edgeMidpoints.set(edge, newIndex);
  }

  // Subdivide triangles
  const newIndices: number[] = [];

  for (let i = 0; i < indexArray.length; i += 3) {
    const i0 = indexArray[i];
    const i1 = indexArray[i + 1];
    const i2 = indexArray[i + 2];

    const edge01 = makeEdgeKey(i0, i1);
    const edge12 = makeEdgeKey(i1, i2);
    const edge20 = makeEdgeKey(i2, i0);

    // Check if this triangle has midpoints (any edge was marked for subdivision)
    const hasMidpoint01 = edgeMidpoints.has(edge01);
    const hasMidpoint12 = edgeMidpoints.has(edge12);
    const hasMidpoint20 = edgeMidpoints.has(edge20);

    const pattern = (hasMidpoint01 ? 1 : 0) + (hasMidpoint12 ? 2 : 0) + (hasMidpoint20 ? 4 : 0);

    switch (pattern) {
      case 0: // No edges subdivided
        newIndices.push(i0, i1, i2);
        break;

      case 1: // Only edge 01 subdivided
        {
          const m01 = edgeMidpoints.get(edge01)!;
          newIndices.push(i0, m01, i2);
          newIndices.push(m01, i1, i2);
        }
        break;

      case 2: // Only edge 12 subdivided
        {
          const m12 = edgeMidpoints.get(edge12)!;
          newIndices.push(i0, i1, m12);
          newIndices.push(i0, m12, i2);
        }
        break;

      case 3: // Edges 01 and 12 subdivided
        {
          const m01 = edgeMidpoints.get(edge01)!;
          const m12 = edgeMidpoints.get(edge12)!;
          newIndices.push(i0, m01, i2);
          newIndices.push(m01, i1, m12);
          newIndices.push(m01, m12, i2);
        }
        break;

      case 4: // Only edge 20 subdivided
        {
          const m20 = edgeMidpoints.get(edge20)!;
          newIndices.push(i0, i1, m20);
          newIndices.push(i1, i2, m20);
        }
        break;

      case 5: // Edges 01 and 20 subdivided
        {
          const m01 = edgeMidpoints.get(edge01)!;
          const m20 = edgeMidpoints.get(edge20)!;
          newIndices.push(i0, m01, m20);
          newIndices.push(m01, i1, i2);
          newIndices.push(m20, m01, i2);
        }
        break;

      case 6: // Edges 12 and 20 subdivided
        {
          const m12 = edgeMidpoints.get(edge12)!;
          const m20 = edgeMidpoints.get(edge20)!;
          newIndices.push(i0, i1, m12);
          newIndices.push(i0, m12, m20);
          newIndices.push(m20, m12, i2);
        }
        break;

      case 7: // All edges subdivided
        {
          const m01 = edgeMidpoints.get(edge01)!;
          const m12 = edgeMidpoints.get(edge12)!;
          const m20 = edgeMidpoints.get(edge20)!;
          newIndices.push(i0, m01, m20);
          newIndices.push(i1, m12, m01);
          newIndices.push(i2, m20, m12);
          newIndices.push(m01, m12, m20);
        }
        break;
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

function makeEdgeKey(i1: number, i2: number): string {
  return i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
}

function buildEdgeAdjacency(indexArray: number[]): Map<string, number[]> {
  const edgeToTriangles = new Map<string, number[]>();

  for (let i = 0; i < indexArray.length; i += 3) {
    const triangleIndex = i / 3;
    const i0 = indexArray[i];
    const i1 = indexArray[i + 1];
    const i2 = indexArray[i + 2];

    const edges = [
      [i0, i1],
      [i1, i2],
      [i2, i0]
    ];

    for (const [a, b] of edges) {
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (!edgeToTriangles.has(key)) {
        edgeToTriangles.set(key, []);
      }
      edgeToTriangles.get(key)!.push(triangleIndex);
    }
  }

  return edgeToTriangles;
}