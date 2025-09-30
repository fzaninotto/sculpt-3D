import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { subdivideSymmetrically } from '../symmetricSubdivision';
import { PrimitiveFactory } from '../../services/geometry/primitiveFactory';

/**
 * Helper to verify mesh has no T-junctions (holes/tears)
 * Every edge should be shared by exactly 2 triangles in a watertight mesh
 */
function verifyWatertightMesh(geometry: THREE.BufferGeometry): {
  isWatertight: boolean;
  issues: string[];
} {
  const indices = geometry.getIndex();
  if (!indices) return { isWatertight: false, issues: ['No indices'] };

  const indexArray = Array.from(indices.array);
  const edgeCount = new Map<string, number>();

  // Count how many triangles use each edge
  for (let i = 0; i < indexArray.length; i += 3) {
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
      edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
    }
  }

  const issues: string[] = [];
  let isWatertight = true;

  // Check each edge
  for (const [edge, count] of edgeCount) {
    if (count !== 2) {
      isWatertight = false;
      issues.push(`Edge ${edge} used by ${count} triangles (expected 2)`);
    }
  }

  return { isWatertight, issues };
}

/**
 * Helper to find T-junctions: vertices that lie on an edge but aren't endpoints
 */
function findTJunctions(geometry: THREE.BufferGeometry): string[] {
  const positions = geometry.getAttribute('position');
  const indices = geometry.getIndex();
  if (!indices) return ['No indices'];

  const indexArray = Array.from(indices.array);
  const vertices: THREE.Vector3[] = [];

  for (let i = 0; i < positions.count; i++) {
    vertices.push(new THREE.Vector3(
      positions.getX(i),
      positions.getY(i),
      positions.getZ(i)
    ));
  }

  const tJunctions: string[] = [];
  const epsilon = 0.0001;

  // Check each vertex
  for (let vertIdx = 0; vertIdx < vertices.length; vertIdx++) {
    const vertex = vertices[vertIdx];

    // Check against all edges
    for (let i = 0; i < indexArray.length; i += 3) {
      const i0 = indexArray[i];
      const i1 = indexArray[i + 1];
      const i2 = indexArray[i + 2];

      const edges = [
        [i0, i1],
        [i1, i2],
        [i2, i0]
      ];

      for (const [a, b] of edges) {
        // Skip if vertex is an endpoint of this edge
        if (vertIdx === a || vertIdx === b) continue;

        const v1 = vertices[a];
        const v2 = vertices[b];

        // Check if vertex lies on the line segment between v1 and v2
        const edgeVec = v2.clone().sub(v1);
        const vertVec = vertex.clone().sub(v1);

        const edgeLength = edgeVec.length();
        if (edgeLength < epsilon) continue;

        // Project vertex onto edge
        const t = vertVec.dot(edgeVec) / (edgeLength * edgeLength);

        // Check if projection is within the edge (not beyond endpoints)
        if (t > epsilon && t < (1 - epsilon)) {
          const projection = v1.clone().add(edgeVec.multiplyScalar(t));
          const distance = vertex.distanceTo(projection);

          if (distance < epsilon) {
            tJunctions.push(
              `Vertex ${vertIdx} at (${vertex.x.toFixed(3)}, ${vertex.y.toFixed(3)}, ${vertex.z.toFixed(3)}) ` +
              `lies on edge ${a}-${b} at t=${t.toFixed(3)}`
            );
          }
        }
      }
    }
  }

  return tJunctions;
}

describe('Symmetric Subdivision', () => {
  describe('Real-World Geometries from PrimitiveFactory', () => {
    it('should handle actual sphere from app (IcosahedronGeometry with high subdivisions)', () => {
      // This is the exact geometry created by the app for spheres
      const geometry = PrimitiveFactory.createGeometry('sphere', [1, 1, 1]);

      // Check initial state
      console.log('[Sphere Test] Has index?', geometry.getIndex() !== null);
      console.log('[Sphere Test] Vertex count:', geometry.getAttribute('position').count);

      const clickPoint = new THREE.Vector3(0.5, 0.5, 0);

      const result = subdivideSymmetrically(
        geometry,
        [clickPoint],
        0.5,
        0.2
      );

      const validation = verifyWatertightMesh(result);

      if (!validation.isWatertight) {
        console.log('\n=== SPHERE TEARING DETECTED ===');
        console.log('Issues:', validation.issues.slice(0, 10));
      }

      expect(validation.isWatertight).toBe(true);
    });

    it('should handle cube (BoxGeometry) subdivision near edges', () => {
      // Simulate app's cube with segments
      const geometry = PrimitiveFactory.createGeometry('cube', [1, 1, 1]);

      console.log('[Cube Test] Has index?', geometry.getIndex() !== null);
      console.log('[Cube Test] Vertex count:', geometry.getAttribute('position').count);

      // Click near a corner/edge where topology changes
      const clickPoint = new THREE.Vector3(0.7, 0.7, 0.7);

      const result = subdivideSymmetrically(
        geometry,
        [clickPoint],
        0.5,
        0.15
      );

      const validation = verifyWatertightMesh(result);

      if (!validation.isWatertight) {
        console.log('\n=== CUBE EDGE TEARING DETECTED ===');
        console.log('Issues:', validation.issues.slice(0, 10));
      }

      expect(validation.isWatertight).toBe(true);
    });

    it('should handle cylinder (CylinderGeometry) subdivision near disc edges', () => {
      // Simulate app's cylinder
      const geometry = PrimitiveFactory.createGeometry('cylinder', [1, 1, 1]);

      console.log('[Cylinder Test] Has index?', geometry.getIndex() !== null);
      console.log('[Cylinder Test] Vertex count:', geometry.getAttribute('position').count);

      // Click near the top disc edge where cap meets side
      const clickPoint = new THREE.Vector3(0.6, 0.9, 0);

      const result = subdivideSymmetrically(
        geometry,
        [clickPoint],
        0.5,
        0.15
      );

      const validation = verifyWatertightMesh(result);

      if (!validation.isWatertight) {
        console.log('\n=== CYLINDER DISC EDGE TEARING DETECTED ===');
        console.log('Issues:', validation.issues.slice(0, 10));
      }

      expect(validation.isWatertight).toBe(true);
    });

    it('should handle cone (ConeGeometry) subdivision', () => {
      const geometry = PrimitiveFactory.createGeometry('cone', [1, 1, 1]);

      console.log('[Cone Test] Has index?', geometry.getIndex() !== null);
      console.log('[Cone Test] Vertex count:', geometry.getAttribute('position').count);

      const clickPoint = new THREE.Vector3(0.5, 0, 0);

      const result = subdivideSymmetrically(
        geometry,
        [clickPoint],
        0.5,
        0.15
      );

      const validation = verifyWatertightMesh(result);

      if (!validation.isWatertight) {
        console.log('\n=== CONE TEARING DETECTED ===');
        console.log('Issues:', validation.issues.slice(0, 10));
      }

      expect(validation.isWatertight).toBe(true);
    });

    it('should handle torus (TorusGeometry) subdivision', () => {
      const geometry = PrimitiveFactory.createGeometry('torus', [1, 1, 1]);

      console.log('[Torus Test] Has index?', geometry.getIndex() !== null);
      console.log('[Torus Test] Vertex count:', geometry.getAttribute('position').count);

      const clickPoint = new THREE.Vector3(1.2, 0, 0);

      const result = subdivideSymmetrically(
        geometry,
        [clickPoint],
        0.5,
        0.15
      );

      const validation = verifyWatertightMesh(result);

      if (!validation.isWatertight) {
        console.log('\n=== TORUS TEARING DETECTED ===');
        console.log('Issues:', validation.issues.slice(0, 10));
      }

      expect(validation.isWatertight).toBe(true);
    });
  });

  describe('Topology Validation', () => {
    it('should create watertight mesh after subdividing icosphere', () => {
      // Create simple icosphere
      const geometry = new THREE.IcosahedronGeometry(1, 2);

      const positions = geometry.getAttribute('position');
      const clickPoint = new THREE.Vector3(
        positions.getX(0),
        positions.getY(0),
        positions.getZ(0)
      );

      const result = subdivideSymmetrically(
        geometry,
        [clickPoint],
        0.5,  // radius
        0.2   // maxEdgeLength
      );

      const validation = verifyWatertightMesh(result);

      if (!validation.isWatertight) {
        console.log('Mesh is NOT watertight!');
        console.log('Issues found:', validation.issues.slice(0, 10)); // Show first 10
      }

      expect(validation.isWatertight).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should not create T-junctions', () => {
      const geometry = new THREE.IcosahedronGeometry(1, 2);

      const positions = geometry.getAttribute('position');
      const clickPoint = new THREE.Vector3(
        positions.getX(0),
        positions.getY(0),
        positions.getZ(0)
      );

      const result = subdivideSymmetrically(
        geometry,
        [clickPoint],
        0.5,
        0.2
      );

      const tJunctions = findTJunctions(result);

      if (tJunctions.length > 0) {
        console.log('T-junctions found!');
        console.log(tJunctions.slice(0, 5)); // Show first 5
      }

      expect(tJunctions).toHaveLength(0);
    });

    it('should handle simple quad subdivision', () => {
      // Create a simple quad (2 triangles) - indexed geometry
      const geometry = new THREE.BufferGeometry();

      const vertices = new Float32Array([
        -1, -1, 0,  // 0
         1, -1, 0,  // 1
         1,  1, 0,  // 2
        -1,  1, 0,  // 3
      ]);

      const indices = [
        0, 1, 2,  // Triangle 1
        0, 2, 3,  // Triangle 2
      ];

      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      geometry.setIndex(indices);

      // Subdivide around center
      const result = subdivideSymmetrically(
        geometry,
        [new THREE.Vector3(0, 0, 0)],
        1.5,  // Large radius to cover entire quad
        0.5   // Small maxEdgeLength to force subdivision
      );

      // Quad is an open mesh with boundaries, so it won't be watertight
      // Just verify subdivision happened (more vertices than before)
      expect(result.getAttribute('position').count).toBeGreaterThan(4);
    });

    it('should handle partial subdivision at boundary', () => {
      // This is the critical test - subdivide only part of the mesh
      const geometry = new THREE.IcosahedronGeometry(1, 1);

      // Pick a point on one side
      const clickPoint = new THREE.Vector3(1, 0, 0);

      const result = subdivideSymmetrically(
        geometry,
        [clickPoint],
        0.8,  // Medium radius - will only affect nearby triangles
        0.3   // Force subdivision
      );

      const validation = verifyWatertightMesh(result);

      if (!validation.isWatertight) {
        console.log('\n=== PARTIAL SUBDIVISION TEST FAILED ===');
        console.log('This reproduces the tearing bug!');
        console.log('Issues:', validation.issues.slice(0, 10));
      }

      expect(validation.isWatertight).toBe(true);
    });

    it('should handle multiple subdivision points (symmetry)', () => {
      const geometry = new THREE.IcosahedronGeometry(1, 2);

      // Simulate X-axis symmetry
      const clickPoint = new THREE.Vector3(0.5, 0.5, 0);
      const mirrorPoint = new THREE.Vector3(-0.5, 0.5, 0);

      const result = subdivideSymmetrically(
        geometry,
        [clickPoint, mirrorPoint],
        0.5,
        0.2
      );

      const validation = verifyWatertightMesh(result);
      expect(validation.isWatertight).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle no subdivision needed', () => {
      const geometry = new THREE.IcosahedronGeometry(1, 2);
      const initialVertices = geometry.getAttribute('position').count;

      // Point far away - no subdivision should occur
      const result = subdivideSymmetrically(
        geometry,
        [new THREE.Vector3(100, 100, 100)],
        0.5,
        0.2
      );

      // May return new geometry with merged vertices (which is good for topology)
      // Or return same geometry if already properly indexed
      // Should not add vertices from subdivision though
      const finalVertices = result.getAttribute('position').count;
      expect(finalVertices).toBeLessThanOrEqual(initialVertices);
    });

    it('should maintain vertex count relationship', () => {
      const geometry = new THREE.IcosahedronGeometry(1, 1);
      // Note: IcosahedronGeometry might be non-indexed, so vertices will be merged
      // We just verify that subdivision adds vertices

      const result = subdivideSymmetrically(
        geometry,
        [new THREE.Vector3(1, 0, 0)],
        0.8,
        0.3
      );

      const finalVertices = result.getAttribute('position').count;

      // After subdivision, should have a reasonable number of vertices
      // IcosahedronGeometry(1,1) has 20 faces, so should have ~12 vertices after merging
      // After subdivision in the target area, should have more
      expect(finalVertices).toBeGreaterThan(12);
    });
  });
});