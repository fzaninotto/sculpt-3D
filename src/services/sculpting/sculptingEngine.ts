import * as THREE from 'three';
import { subdivideSymmetrically } from '../../utils/symmetricSubdivision';
import { ensureGeometrySymmetry } from '../../utils/ensureGeometrySymmetry';
import type { ToolType } from '../../types';

export interface SculptingStrokeParams {
  geometry: THREE.BufferGeometry;
  clickPoint: THREE.Vector3;  // in local space
  tool: ToolType;
  brushSize: number;
  brushStrength: number;
  symmetryAxes: { x: boolean; y: boolean; z: boolean };
  pushToolPreviousPoint?: THREE.Vector3 | null;  // in local space, for push tool
  invert?: boolean;  // for shift key
  shouldSubdivide?: boolean;
  cloneGeometry?: boolean;  // if true, clones geometry before modifying (for tests)
  ensureSymmetry?: boolean;  // if true, runs expensive symmetry check (for tests only)
}

export interface SculptingStrokeResult {
  geometry: THREE.BufferGeometry;
  modified: boolean;
}

/**
 * Calculate all symmetry points from a given local point
 */
export function calculateSymmetryPoints(
  localPoint: THREE.Vector3,
  symmetryAxes: { x: boolean; y: boolean; z: boolean }
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [localPoint.clone()];

  if (!symmetryAxes.x && !symmetryAxes.y && !symmetryAxes.z) {
    return points;
  }

  const mirrorConfigs: Array<{ x: boolean; y: boolean; z: boolean }> = [];

  if (symmetryAxes.x) mirrorConfigs.push({ x: true, y: false, z: false });
  if (symmetryAxes.y) mirrorConfigs.push({ x: false, y: true, z: false });
  if (symmetryAxes.z) mirrorConfigs.push({ x: false, y: false, z: true });
  if (symmetryAxes.x && symmetryAxes.y) mirrorConfigs.push({ x: true, y: true, z: false });
  if (symmetryAxes.x && symmetryAxes.z) mirrorConfigs.push({ x: true, y: false, z: true });
  if (symmetryAxes.y && symmetryAxes.z) mirrorConfigs.push({ x: false, y: true, z: true });
  if (symmetryAxes.x && symmetryAxes.y && symmetryAxes.z) {
    mirrorConfigs.push({ x: true, y: true, z: true });
  }

  for (const config of mirrorConfigs) {
    const mirrorPoint = localPoint.clone();
    if (config.x) mirrorPoint.x = -mirrorPoint.x;
    if (config.y) mirrorPoint.y = -mirrorPoint.y;
    if (config.z) mirrorPoint.z = -mirrorPoint.z;
    points.push(mirrorPoint);
  }

  return points;
}

/**
 * Apply symmetric subdivision around all symmetry points simultaneously
 */
function applySymmetricSubdivision(
  geometry: THREE.BufferGeometry,
  localPoints: THREE.Vector3[],
  localRadius: number,
  localMaxEdge: number
): THREE.BufferGeometry {
  // Subdivide all points simultaneously to maintain topology symmetry
  return subdivideSymmetrically(geometry, localPoints, localRadius, localMaxEdge);
}

/**
 * Calculate the deformation direction for a tool
 */
function calculateDirection(
  tool: ToolType,
  avgNormal: THREE.Vector3,
  clickPoint: THREE.Vector3,
  previousPoint: THREE.Vector3 | null,
  mirrorConfig: { x: boolean; y: boolean; z: boolean } | null
): THREE.Vector3 | null {
  if (tool === 'push') {
    if (!previousPoint) return null;

    let direction = clickPoint.clone().sub(previousPoint);

    // If this is a mirrored point, mirror the movement
    if (mirrorConfig) {
      if (mirrorConfig.x) direction.x = -direction.x;
      if (mirrorConfig.y) direction.y = -direction.y;
      if (mirrorConfig.z) direction.z = -direction.z;
    }

    if (direction.length() < 0.001) return null;
    return direction.normalize();
  } else {
    // For add/subtract, use normal
    let direction = avgNormal.clone();

    // Mirror the normal if needed
    if (mirrorConfig) {
      if (mirrorConfig.x) direction.x = -direction.x;
      if (mirrorConfig.y) direction.y = -direction.y;
      if (mirrorConfig.z) direction.z = -direction.z;
      direction.normalize();
    }

    return direction;
  }
}

/**
 * Calculate the average normal in the brush area
 */
function calculateAverageNormal(
  geometry: THREE.BufferGeometry,
  clickPoint: THREE.Vector3,
  brushSize: number
): THREE.Vector3 {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');

  if (!normals) {
    return new THREE.Vector3(0, 1, 0);
  }

  const posArray = positions.array as Float32Array;
  const normalsArray = normals.array as Float32Array;

  let avgNormal = new THREE.Vector3();
  let count = 0;

  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3(
      posArray[i * 3],
      posArray[i * 3 + 1],
      posArray[i * 3 + 2]
    );

    const distance = vertex.distanceTo(clickPoint);
    if (distance < brushSize * 0.5) {
      const normal = new THREE.Vector3(
        normalsArray[i * 3],
        normalsArray[i * 3 + 1],
        normalsArray[i * 3 + 2]
      );
      avgNormal.add(normal);
      count++;
    }
  }

  if (count > 0) {
    avgNormal.divideScalar(count);
    avgNormal.normalize();
  } else {
    avgNormal.set(0, 1, 0);
  }

  return avgNormal;
}

/**
 * Apply deformation around symmetry points
 */
function applyDeformation(
  geometry: THREE.BufferGeometry,
  symmetryPoints: THREE.Vector3[],
  tool: ToolType,
  brushSize: number,
  brushStrength: number,
  clickPoint: THREE.Vector3,
  previousPoint: THREE.Vector3 | null,
  invert: boolean
): boolean {
  const positions = geometry.getAttribute('position');
  const positionsArray = positions.array as Float32Array;

  // Calculate average normal once (based on original click point)
  const avgNormal = calculateAverageNormal(geometry, clickPoint, brushSize);

  let modified = false;

  // Apply deformation for each symmetry point
  for (let symIdx = 0; symIdx < symmetryPoints.length; symIdx++) {
    const symPoint = symmetryPoints[symIdx];
    const isOriginal = symIdx === 0;

    // Determine mirror configuration for this point
    const mirrorConfig = isOriginal ? null : {
      x: Math.sign(symPoint.x) !== Math.sign(clickPoint.x),
      y: Math.sign(symPoint.y) !== Math.sign(clickPoint.y),
      z: Math.sign(symPoint.z) !== Math.sign(clickPoint.z),
    };

    // Calculate direction for this symmetry point
    const direction = calculateDirection(tool, avgNormal, clickPoint, previousPoint, mirrorConfig);
    if (!direction) continue;

    // Apply deformation to vertices near this symmetry point
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positionsArray[i * 3],
        positionsArray[i * 3 + 1],
        positionsArray[i * 3 + 2]
      );

      const distance = vertex.distanceTo(symPoint);

      if (distance < brushSize) {
        const falloff = 1 - (distance / brushSize);
        const strength = brushStrength * falloff * falloff * 0.2;

        let multiplier = strength;

        if (tool === 'push') {
          const moveDistance = previousPoint ? clickPoint.distanceTo(previousPoint) : 0;
          multiplier = strength * Math.min(moveDistance * 25, 5.0);
          if (invert) multiplier = -multiplier;
        } else {
          if (tool === 'subtract') {
            multiplier = -strength;
          }
          if (invert) {
            multiplier = -multiplier;
          }
        }

        vertex.add(direction.clone().multiplyScalar(multiplier));

        positionsArray[i * 3] = vertex.x;
        positionsArray[i * 3 + 1] = vertex.y;
        positionsArray[i * 3 + 2] = vertex.z;

        modified = true;
      }
    }
  }

  return modified;
}

/**
 * Main function: Apply a sculpting stroke with subdivision and symmetry
 * Note: By default, modifies geometry in place for performance.
 * Set cloneGeometry=true for immutable behavior (useful in tests).
 */
export function applySculptingStroke(params: SculptingStrokeParams): SculptingStrokeResult {
  let geometry = params.cloneGeometry ? params.geometry.clone() : params.geometry;
  const tool = params.tool;

  // Calculate all symmetry points
  const symmetryPoints = calculateSymmetryPoints(params.clickPoint, params.symmetryAxes);

  // Apply subdivision around all symmetry points if requested
  if (params.shouldSubdivide !== false) {
    const localRadius = params.brushSize * 1.5;
    const localMaxEdge = params.brushSize * 0.25;

    geometry = applySymmetricSubdivision(geometry, symmetryPoints, localRadius, localMaxEdge);

    // Ensure topology is perfectly symmetric by adding any missing mirror vertices
    // This is expensive (O(n²)), so only run in tests
    if (params.ensureSymmetry) {
      geometry = ensureGeometrySymmetry(geometry, params.symmetryAxes, 0.01);
    }
  }

  // Apply deformation
  const modified = applyDeformation(
    geometry,
    symmetryPoints,
    tool,
    params.brushSize,
    params.brushStrength,
    params.clickPoint,
    params.pushToolPreviousPoint || null,
    params.invert || false
  );

  if (modified) {
    const positions = geometry.getAttribute('position');
    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  return {
    geometry,
    modified
  };
}