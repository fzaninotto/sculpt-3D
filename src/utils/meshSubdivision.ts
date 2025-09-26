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
 * Build edge-to-triangle adjacency map
 */
function buildEdgeAdjacency(indexArray: number[]): Map<string, number[]> {
  const edgeToTriangles = new Map<string, number[]>();

  for (let i = 0; i < indexArray.length; i += 3) {
    const triangleIndex = i / 3;
    const i0 = indexArray[i];
    const i1 = indexArray[i + 1];
    const i2 = indexArray[i + 2];

    // Add all three edges
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

/**
 * Make edge key from two vertex indices
 */
function makeEdgeKey(i1: number, i2: number): string {
  return i1 < i2 ? `${i1}-${i2}` : `${i2}-${i1}`;
}

/**
 * Adaptive subdivision with transition patterns to prevent T-junctions
 */
export function subdivideGeometryLocally(
  geometry: THREE.BufferGeometry,
  point: THREE.Vector3,
  radius: number,
  maxEdgeLength: number = 0.5
): THREE.BufferGeometry {
  // Clone the geometry to prevent concurrent modification issues
  const workingGeometry = geometry.clone();
  const positions = workingGeometry.getAttribute('position');
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
  let indices = workingGeometry.getIndex();
  let indexArray: number[];

  if (indices) {
    indexArray = Array.from(indices.array);
  } else {
    indexArray = [];
    for (let i = 0; i < vertices.length - 2; i += 3) {
      indexArray.push(i, i + 1, i + 2);
    }
  }

  // Build edge adjacency
  const edgeToTriangles = buildEdgeAdjacency(indexArray);

  // STEP 1: Mark edges for subdivision (not triangles)
  const edgesToSubdivide = new Set<string>();

  // First pass: identify edges that need subdivision
  for (let i = 0; i < indexArray.length; i += 3) {
    const i0 = indexArray[i];
    const i1 = indexArray[i + 1];
    const i2 = indexArray[i + 2];

    const v0 = vertices[i0];
    const v1 = vertices[i1];
    const v2 = vertices[i2];

    // Check each edge independently
    // Edge 01
    const edge01Length = v0.distanceTo(v1);
    if (edge01Length > maxEdgeLength) {
      const edge01Mid = v0.clone().add(v1).multiplyScalar(0.5);
      // Check if edge midpoint is within radius OR if edge is too long regardless
      if (edge01Mid.distanceTo(point) < radius || edge01Length > maxEdgeLength * 2) {
        edgesToSubdivide.add(makeEdgeKey(i0, i1));
      }
    }

    // Edge 12
    const edge12Length = v1.distanceTo(v2);
    if (edge12Length > maxEdgeLength) {
      const edge12Mid = v1.clone().add(v2).multiplyScalar(0.5);
      if (edge12Mid.distanceTo(point) < radius || edge12Length > maxEdgeLength * 2) {
        edgesToSubdivide.add(makeEdgeKey(i1, i2));
      }
    }

    // Edge 20
    const edge20Length = v2.distanceTo(v0);
    if (edge20Length > maxEdgeLength) {
      const edge20Mid = v2.clone().add(v0).multiplyScalar(0.5);
      if (edge20Mid.distanceTo(point) < radius || edge20Length > maxEdgeLength * 2) {
        edgesToSubdivide.add(makeEdgeKey(i2, i0));
      }
    }
  }

  // Second pass: propagate to ensure consistency
  // If an edge is marked, we need to ensure neighbor triangles can handle it
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

        // Count how many edges of this triangle are marked
        const edge01 = makeEdgeKey(i0, i1);
        const edge12 = makeEdgeKey(i1, i2);
        const edge20 = makeEdgeKey(i2, i0);

        let markedCount = 0;
        if (edgesToSubdivide.has(edge01)) markedCount++;
        if (edgesToSubdivide.has(edge12)) markedCount++;
        if (edgesToSubdivide.has(edge20)) markedCount++;

        // If 2 edges are marked, mark the third for better mesh quality
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


  // STEP 2: Create midpoints for marked edges
  const newVertices = [...vertices];
  const edgeMidpoints = new Map<string, number>();

  for (const edge of edgesToSubdivide) {
    const [i1, i2] = edge.split('-').map(Number);
    const v1 = vertices[i1];
    const v2 = vertices[i2];
    const midpoint = v1.clone().add(v2).multiplyScalar(0.5);

    // For spherical surfaces, project the midpoint back onto the sphere
    // Check if this looks like a sphere by testing if vertices are roughly unit distance from origin
    const v1Length = v1.length();
    const v2Length = v2.length();
    const avgLength = (v1Length + v2Length) * 0.5;

    // If vertices are roughly on a sphere surface (within reasonable tolerance)
    if (Math.abs(v1Length - avgLength) < 0.3 && Math.abs(v2Length - avgLength) < 0.3) {
      // Project midpoint to sphere surface
      midpoint.normalize().multiplyScalar(avgLength);
    }

    const newIndex = newVertices.length;
    newVertices.push(midpoint);
    edgeMidpoints.set(edge, newIndex);
  }

  // STEP 3: Process triangles with adaptive patterns
  const newIndices: number[] = [];

  for (let i = 0; i < indexArray.length; i += 3) {
    const i0 = indexArray[i];
    const i1 = indexArray[i + 1];
    const i2 = indexArray[i + 2];

    const edge01 = makeEdgeKey(i0, i1);
    const edge12 = makeEdgeKey(i1, i2);
    const edge20 = makeEdgeKey(i2, i0);

    const hasEdge01 = edgesToSubdivide.has(edge01);
    const hasEdge12 = edgesToSubdivide.has(edge12);
    const hasEdge20 = edgesToSubdivide.has(edge20);

    const pattern = (hasEdge01 ? 1 : 0) + (hasEdge12 ? 2 : 0) + (hasEdge20 ? 4 : 0);

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

  // Set new positions
  const newPosArray = new Float32Array(newVertices.length * 3);
  for (let i = 0; i < newVertices.length; i++) {
    newPosArray[i * 3] = newVertices[i].x;
    newPosArray[i * 3 + 1] = newVertices[i].y;
    newPosArray[i * 3 + 2] = newVertices[i].z;
  }

  newGeometry.setAttribute('position', new THREE.BufferAttribute(newPosArray, 3));
  newGeometry.setIndex(newIndices);

  // Compute normals and bounds
  newGeometry.computeVertexNormals();
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

  return subdivideGeometryLocally(geometry, center, 1000, 0.5);
}