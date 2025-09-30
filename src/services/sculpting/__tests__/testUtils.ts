import * as THREE from 'three';

/**
 * Create a UV sphere for testing
 */
export function createTestSphere(radius: number = 1, widthSegments: number = 8, heightSegments: number = 6): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Create a simple cube for testing
 */
export function createTestCube(size: number = 1): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(size, size, size);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Find a vertex that mirrors another vertex across symmetry axes
 */
export function findMirrorVertex(
  geometry: THREE.BufferGeometry,
  vertexIndex: number,
  mirrorAxes: { x?: boolean; y?: boolean; z?: boolean },
  tolerance: number = 0.001
): number | null {
  const positions = geometry.getAttribute('position');
  const posArray = positions.array as Float32Array;

  const vx = posArray[vertexIndex * 3];
  const vy = posArray[vertexIndex * 3 + 1];
  const vz = posArray[vertexIndex * 3 + 2];

  // Calculate expected mirror position
  const mirrorX = mirrorAxes.x ? -vx : vx;
  const mirrorY = mirrorAxes.y ? -vy : vy;
  const mirrorZ = mirrorAxes.z ? -vz : vz;

  // Find closest vertex to mirror position
  for (let i = 0; i < positions.count; i++) {
    if (i === vertexIndex) continue;

    const ix = posArray[i * 3];
    const iy = posArray[i * 3 + 1];
    const iz = posArray[i * 3 + 2];

    const distance = Math.sqrt(
      (ix - mirrorX) ** 2 +
      (iy - mirrorY) ** 2 +
      (iz - mirrorZ) ** 2
    );

    if (distance < tolerance) {
      return i;
    }
  }

  return null;
}

/**
 * Verify that geometry is symmetric across specified axes
 */
export function verifyGeometrySymmetry(
  geometry: THREE.BufferGeometry,
  symmetryAxes: { x?: boolean; y?: boolean; z?: boolean },
  tolerance: number = 0.001
): { isSymmetric: boolean; errors: string[] } {
  const positions = geometry.getAttribute('position');
  const posArray = positions.array as Float32Array;
  const errors: string[] = [];
  const checkedVertices = new Set<number>();

  for (let i = 0; i < positions.count; i++) {
    if (checkedVertices.has(i)) continue;

    const mirrorIndex = findMirrorVertex(geometry, i, symmetryAxes, tolerance);

    if (mirrorIndex === null) {
      // Check if this vertex is ON the symmetry plane (in which case it's its own mirror)
      const vx = posArray[i * 3];
      const vy = posArray[i * 3 + 1];
      const vz = posArray[i * 3 + 2];

      const onSymmetryPlane =
        (!symmetryAxes.x || Math.abs(vx) < tolerance) &&
        (!symmetryAxes.y || Math.abs(vy) < tolerance) &&
        (!symmetryAxes.z || Math.abs(vz) < tolerance);

      if (!onSymmetryPlane) {
        errors.push(`Vertex ${i} at (${vx.toFixed(3)}, ${vy.toFixed(3)}, ${vz.toFixed(3)}) has no mirror vertex`);
      }
    } else {
      checkedVertices.add(i);
      checkedVertices.add(mirrorIndex);
    }
  }

  return {
    isSymmetric: errors.length === 0,
    errors
  };
}

/**
 * Compare vertex displacements between two geometries
 */
export function compareVertexDisplacements(
  beforeGeometry: THREE.BufferGeometry,
  afterGeometry: THREE.BufferGeometry
): Map<number, THREE.Vector3> {
  const displacements = new Map<number, THREE.Vector3>();

  const beforePos = beforeGeometry.getAttribute('position');
  const afterPos = afterGeometry.getAttribute('position');

  if (beforePos.count !== afterPos.count) {
    throw new Error('Geometries have different vertex counts');
  }

  const beforeArray = beforePos.array as Float32Array;
  const afterArray = afterPos.array as Float32Array;

  for (let i = 0; i < beforePos.count; i++) {
    const dx = afterArray[i * 3] - beforeArray[i * 3];
    const dy = afterArray[i * 3 + 1] - beforeArray[i * 3 + 1];
    const dz = afterArray[i * 3 + 2] - beforeArray[i * 3 + 2];

    const displacement = new THREE.Vector3(dx, dy, dz);
    if (displacement.length() > 0.0001) {
      displacements.set(i, displacement);
    }
  }

  return displacements;
}

/**
 * Verify that displacements are symmetric
 */
export function verifySymmetricDisplacements(
  geometry: THREE.BufferGeometry,
  displacements: Map<number, THREE.Vector3>,
  symmetryAxes: { x?: boolean; y?: boolean; z?: boolean },
  tolerance: number = 0.01
): { isSymmetric: boolean; errors: string[] } {
  const errors: string[] = [];
  const checkedVertices = new Set<number>();

  for (const [vertexIndex, displacement] of displacements.entries()) {
    if (checkedVertices.has(vertexIndex)) continue;

    const mirrorIndex = findMirrorVertex(geometry, vertexIndex, symmetryAxes);

    if (mirrorIndex === null) {
      // Check if vertex is on symmetry plane
      const positions = geometry.getAttribute('position');
      const posArray = positions.array as Float32Array;
      const vx = posArray[vertexIndex * 3];
      const vy = posArray[vertexIndex * 3 + 1];
      const vz = posArray[vertexIndex * 3 + 2];

      const onSymmetryPlane =
        (!symmetryAxes.x || Math.abs(vx) < tolerance) &&
        (!symmetryAxes.y || Math.abs(vy) < tolerance) &&
        (!symmetryAxes.z || Math.abs(vz) < tolerance);

      if (!onSymmetryPlane) {
        errors.push(`Vertex ${vertexIndex} at (${vx.toFixed(3)}, ${vy.toFixed(3)}, ${vz.toFixed(3)}) was displaced but has no mirror vertex`);
      }
      continue;
    }

    const mirrorDisplacement = displacements.get(mirrorIndex);

    if (!mirrorDisplacement) {
      errors.push(`Vertex ${vertexIndex} was displaced but its mirror vertex ${mirrorIndex} was not`);
      continue;
    }

    // Check if displacements are properly mirrored
    const expectedMirrorDisp = displacement.clone();
    if (symmetryAxes.x) expectedMirrorDisp.x = -expectedMirrorDisp.x;
    if (symmetryAxes.y) expectedMirrorDisp.y = -expectedMirrorDisp.y;
    if (symmetryAxes.z) expectedMirrorDisp.z = -expectedMirrorDisp.z;

    const difference = mirrorDisplacement.clone().sub(expectedMirrorDisp);

    if (difference.length() > tolerance) {
      errors.push(
        `Displacement mismatch at vertex pair (${vertexIndex}, ${mirrorIndex}): ` +
        `expected mirror displacement (${expectedMirrorDisp.x.toFixed(3)}, ${expectedMirrorDisp.y.toFixed(3)}, ${expectedMirrorDisp.z.toFixed(3)}), ` +
        `got (${mirrorDisplacement.x.toFixed(3)}, ${mirrorDisplacement.y.toFixed(3)}, ${mirrorDisplacement.z.toFixed(3)}), ` +
        `difference: ${difference.length().toFixed(3)}`
      );
    }

    checkedVertices.add(vertexIndex);
    checkedVertices.add(mirrorIndex);
  }

  return {
    isSymmetric: errors.length === 0,
    errors
  };
}

/**
 * Get vertex count of geometry
 */
export function getVertexCount(geometry: THREE.BufferGeometry): number {
  return geometry.getAttribute('position')?.count || 0;
}

/**
 * Clone geometry for comparison
 */
export function cloneGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  return geometry.clone();
}