import * as THREE from 'three';
import type { PrimitiveType } from '../../types';

/**
 * Factory for creating primitive geometries with adaptive subdivision
 * based on scale for optimal sculpting resolution
 */
export class PrimitiveFactory {
  private static readonly TARGET_EDGE_LENGTH = 0.1; // Target edge length for sculpting

  /**
   * Create a geometry for the specified primitive type with adaptive detail
   */
  static createGeometry(type: PrimitiveType, scale: [number, number, number]): THREE.BufferGeometry {
    const avgScale = (scale[0] + scale[1] + scale[2]) / 3;
    let geometry: THREE.BufferGeometry;

    switch (type) {
      case 'sphere':
        geometry = this.createSphere(avgScale);
        break;
      case 'cube':
        geometry = this.createCube(avgScale);
        break;
      case 'cylinder':
        geometry = this.createCylinder(avgScale);
        break;
      case 'cone':
        geometry = this.createCone(avgScale);
        break;
      case 'torus':
        geometry = this.createTorus(avgScale);
        break;
      default:
        geometry = this.createSphere(avgScale);
    }

    // Configure geometry for dynamic updates
    this.configureGeometry(geometry);
    return geometry;
  }

  private static createSphere(avgScale: number): THREE.BufferGeometry {
    // Use icosphere (subdivided icosahedron) to avoid pole artifacts
    // The geometry is created with radius=1, but will be scaled by avgScale in the scene

    // For icosahedron at radius=1, subdivision 0, initial edge length ≈ 1.05
    // After world scaling: actualEdgeLength = 1.05 * avgScale / (2^subdivisions)
    const initialEdgeLength = 1.05 * avgScale;

    // Target extremely fine detail for perfectly smooth spheres
    const targetEdgeLength = 0.0075; // 2x finer than 0.015

    // Calculate required subdivisions: initial / (2^N) = target
    // Therefore: N = log2(initial / target)
    const subdivisions = Math.max(5, Math.ceil(Math.log2(initialEdgeLength / targetEdgeLength)));

    return new THREE.IcosahedronGeometry(1, subdivisions);
  }

  private static createCube(avgScale: number): THREE.BufferGeometry {
    const size = avgScale * 1.5; // cube is 1.5 units
    const segments = Math.max(2, Math.min(32, Math.round(size / this.TARGET_EDGE_LENGTH)));
    return new THREE.BoxGeometry(1.5, 1.5, 1.5, segments, segments, segments);
  }

  private static createCylinder(avgScale: number): THREE.BufferGeometry {
    const radius = avgScale * 0.7;
    const height = avgScale * 2;
    const radialSegments = Math.max(8, Math.min(64, Math.round(2 * Math.PI * radius / this.TARGET_EDGE_LENGTH)));
    const heightSegments = Math.max(2, Math.min(32, Math.round(height / this.TARGET_EDGE_LENGTH)));
    return new THREE.CylinderGeometry(0.7, 0.7, 2, radialSegments, heightSegments);
  }

  private static createCone(avgScale: number): THREE.BufferGeometry {
    const radius = avgScale * 1;
    const radialSegments = Math.max(8, Math.min(64, Math.round(2 * Math.PI * radius / this.TARGET_EDGE_LENGTH)));
    const heightSegments = Math.max(2, Math.min(16, Math.round(2 / this.TARGET_EDGE_LENGTH)));
    return new THREE.ConeGeometry(1, 2, radialSegments, heightSegments);
  }

  private static createTorus(avgScale: number): THREE.BufferGeometry {
    const majorRadius = avgScale * 1;
    const minorRadius = avgScale * 0.4;
    const radialSegments = Math.max(6, Math.min(48, Math.round(2 * Math.PI * minorRadius / this.TARGET_EDGE_LENGTH)));
    const tubularSegments = Math.max(8, Math.min(64, Math.round(2 * Math.PI * majorRadius / this.TARGET_EDGE_LENGTH)));
    return new THREE.TorusGeometry(1, 0.4, radialSegments, tubularSegments);
  }

  private static configureGeometry(geometry: THREE.BufferGeometry): void {
    // Set position attribute for dynamic updates
    const positions = geometry.getAttribute('position');
    if (positions && 'setUsage' in positions) {
      (positions as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    }

    // CRITICAL: Merge duplicate vertices to ensure watertight topology
    // Three.js geometries often have duplicate vertices at seams/edges
    // This must be done ONCE at creation time, not during every subdivision
    this.mergeVertices(geometry);

    // Compute normals and bounds
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  /**
   * Merge duplicate vertices and ensure geometry has proper indices
   * This creates watertight topology by removing vertex duplicates at seams
   */
  private static mergeVertices(geometry: THREE.BufferGeometry): void {
    const positions = geometry.getAttribute('position');
    const posArray = positions.array as Float32Array;

    // Convert positions to Vector3 array
    const vertices: THREE.Vector3[] = [];
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
      // Non-indexed: create sequential indices
      indexArray = [];
      for (let i = 0; i < vertices.length; i++) {
        indexArray.push(i);
      }
    }

    // Merge duplicate vertices
    // Use epsilon matching symmetry tolerance to avoid breaking symmetry
    const epsilon = 0.001;
    const vertexMap = new Map<string, number>();
    const vertexRemap = new Map<number, number>();
    const newVertices: THREE.Vector3[] = [];

    for (let i = 0; i < vertices.length; i++) {
      const v = vertices[i];
      const key = `${Math.round(v.x / epsilon)}_${Math.round(v.y / epsilon)}_${Math.round(v.z / epsilon)}`;

      let newIndex = vertexMap.get(key);
      if (newIndex === undefined) {
        newIndex = newVertices.length;
        newVertices.push(v.clone());
        vertexMap.set(key, newIndex);
      }
      vertexRemap.set(i, newIndex);
    }

    // Only update geometry if we actually merged vertices
    if (newVertices.length < vertices.length) {
      // Update positions
      const newPosArray = new Float32Array(newVertices.length * 3);
      for (let i = 0; i < newVertices.length; i++) {
        newPosArray[i * 3] = newVertices[i].x;
        newPosArray[i * 3 + 1] = newVertices[i].y;
        newPosArray[i * 3 + 2] = newVertices[i].z;
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(newPosArray, 3));

      // Remap indices
      for (let i = 0; i < indexArray.length; i++) {
        indexArray[i] = vertexRemap.get(indexArray[i])!;
      }
      geometry.setIndex(indexArray);
    } else if (!indices) {
      // No merging needed but geometry wasn't indexed - add indices
      geometry.setIndex(indexArray);
    }
  }
}