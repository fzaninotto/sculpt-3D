import * as THREE from 'three';

/**
 * Simple triangle-based subdivision that avoids T-junctions
 * by subdividing entire triangles uniformly
 */
export function subdivideGeometryLocally(
  geometry: THREE.BufferGeometry,
  point: THREE.Vector3,
  radius: number,
  maxEdgeLength: number
): THREE.BufferGeometry {
  const positions = geometry.getAttribute('position');
  const indices = geometry.getIndex();

  if (!positions || !indices) {
    return geometry;
  }

  const positionsArray = positions.array as Float32Array;
  const indexArray = indices.array as number[];

  // Convert to vertices
  const vertices: THREE.Vector3[] = [];
  for (let i = 0; i < positions.count; i++) {
    vertices.push(new THREE.Vector3(
      positionsArray[i * 3],
      positionsArray[i * 3 + 1],
      positionsArray[i * 3 + 2]
    ));
  }

  // Find triangles that need subdivision
  const trianglesToSubdivide = new Set<number>();

  for (let i = 0; i < indexArray.length; i += 3) {
    const triIndex = i / 3;
    const i0 = indexArray[i];
    const i1 = indexArray[i + 1];
    const i2 = indexArray[i + 2];

    const v0 = vertices[i0];
    const v1 = vertices[i1];
    const v2 = vertices[i2];

    // Check if triangle center is within radius
    const center = v0.clone().add(v1).add(v2).multiplyScalar(1/3);
    const distanceToCenter = center.distanceTo(point);

    // Check if any edge is too long
    const edge01 = v0.distanceTo(v1);
    const edge12 = v1.distanceTo(v2);
    const edge20 = v2.distanceTo(v0);
    const maxEdge = Math.max(edge01, edge12, edge20);

    // Subdivide if triangle is near the point AND has long edges
    if (distanceToCenter < radius && maxEdge > maxEdgeLength) {
      trianglesToSubdivide.add(triIndex);
    }
  }

  // If no triangles need subdivision, return original
  if (trianglesToSubdivide.size === 0) {
    return geometry;
  }

  // Create new geometry with subdivided triangles
  const newVertices = [...vertices];
  const newIndices: number[] = [];

  for (let i = 0; i < indexArray.length; i += 3) {
    const triIndex = i / 3;
    const i0 = indexArray[i];
    const i1 = indexArray[i + 1];
    const i2 = indexArray[i + 2];

    if (trianglesToSubdivide.has(triIndex)) {
      // Subdivide this triangle into 4 triangles
      const v0 = vertices[i0];
      const v1 = vertices[i1];
      const v2 = vertices[i2];

      // Create midpoints
      const m01 = v0.clone().add(v1).multiplyScalar(0.5);
      const m12 = v1.clone().add(v2).multiplyScalar(0.5);
      const m20 = v2.clone().add(v0).multiplyScalar(0.5);

      // For spherical surfaces, project midpoints back to sphere
      const v0Length = v0.length();
      const v1Length = v1.length();
      const v2Length = v2.length();
      const avgLength = (v0Length + v1Length + v2Length) / 3;

      if (Math.abs(v0Length - avgLength) < 0.3 &&
          Math.abs(v1Length - avgLength) < 0.3 &&
          Math.abs(v2Length - avgLength) < 0.3) {
        m01.normalize().multiplyScalar(avgLength);
        m12.normalize().multiplyScalar(avgLength);
        m20.normalize().multiplyScalar(avgLength);
      }

      // Add new vertices
      const im01 = newVertices.length;
      newVertices.push(m01);
      const im12 = newVertices.length;
      newVertices.push(m12);
      const im20 = newVertices.length;
      newVertices.push(m20);

      // Create 4 new triangles
      // Center triangle
      newIndices.push(im01, im12, im20);
      // Corner triangles
      newIndices.push(i0, im01, im20);
      newIndices.push(i1, im12, im01);
      newIndices.push(i2, im20, im12);
    } else {
      // Keep original triangle
      newIndices.push(i0, i1, i2);
    }
  }

  // Create new geometry
  const newGeometry = new THREE.BufferGeometry();

  // Convert vertices back to Float32Array
  const newPositionsArray = new Float32Array(newVertices.length * 3);
  for (let i = 0; i < newVertices.length; i++) {
    const v = newVertices[i];
    newPositionsArray[i * 3] = v.x;
    newPositionsArray[i * 3 + 1] = v.y;
    newPositionsArray[i * 3 + 2] = v.z;
  }

  newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositionsArray, 3));
  newGeometry.setIndex(newIndices);
  newGeometry.computeVertexNormals();
  newGeometry.computeBoundingBox();
  newGeometry.computeBoundingSphere();

  return newGeometry;
}