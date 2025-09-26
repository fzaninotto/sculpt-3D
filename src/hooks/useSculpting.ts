import { useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ToolType } from '../types';
import { subdivideGeometryLocally } from '../utils/meshSubdivision';

interface SculptingParams {
  meshRef: React.MutableRefObject<THREE.Mesh | null>;
  currentTool: ToolType;
  brushSize: number;
  brushStrength: number;
  isSelected: boolean;
  onGeometryUpdate?: (geometry: THREE.BufferGeometry) => void;
}

export function useSculpting({
  meshRef,
  currentTool,
  brushSize,
  brushStrength,
  isSelected,
  onGeometryUpdate,
}: SculptingParams) {
  const { raycaster, camera } = useThree();
  const isProcessing = useRef(false);
  const lastSubdivisionTime = useRef(0);
  const pushToolLastPoint = useRef<THREE.Vector3 | null>(null);
  const isShiftPressed = useRef(false);
  const mousePosition = useRef({ x: 0, y: 0 });

  const isSculptMode = ['add', 'subtract', 'push'].includes(currentTool);

  // Handle keyboard modifiers
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        isShiftPressed.current = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        isShiftPressed.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const resetPushTool = useCallback(() => {
    if (currentTool === 'push') {
      pushToolLastPoint.current = null;
    }
  }, [currentTool]);

  const updateMousePosition = useCallback((x: number, y: number) => {
    mousePosition.current = { x, y };
  }, []);

  const sculpt = useCallback(() => {
    if (!meshRef.current || !isSelected || !isSculptMode || isProcessing.current) {
      return false;
    }

    isProcessing.current = true;
    const mesh = meshRef.current;
    let geometry = mesh.geometry as THREE.BufferGeometry;

    // Cast ray
    const mouse = new THREE.Vector2(mousePosition.current.x, mousePosition.current.y);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length === 0) {
      isProcessing.current = false;
      return false;
    }

    const intersection = intersects[0];
    const point = intersection.point;

    // Subdivision phase
    const now = Date.now();
    const shouldSubdivide = now - lastSubdivisionTime.current > 100;

    if (shouldSubdivide) {
      const localPoint = point.clone();
      const invMatrix = mesh.matrixWorld.clone().invert();
      localPoint.applyMatrix4(invMatrix);

      const worldScale = mesh.scale.length() / Math.sqrt(3);
      const localRadius = (brushSize * 1.5) / worldScale;
      const localMaxEdge = (brushSize * 0.25) / worldScale;

      const subdividedGeo = subdivideGeometryLocally(
        geometry,
        localPoint,
        localRadius,
        localMaxEdge
      );

      if (subdividedGeo.getAttribute('position').count > geometry.getAttribute('position').count) {
        geometry = subdividedGeo;
        mesh.geometry = geometry;
        onGeometryUpdate?.(geometry);
        lastSubdivisionTime.current = now;
      }
    }

    // Deformation phase
    const positions = geometry.getAttribute('position');
    if (!positions) {
      isProcessing.current = false;
      return false;
    }

    const positionsArray = positions.array as Float32Array;
    let modified = false;

    // Calculate average normal
    const faceNormal = intersection.face ? intersection.face.normal.clone() : new THREE.Vector3(0, 1, 0);
    faceNormal.transformDirection(mesh.matrixWorld);
    faceNormal.normalize();

    const normals = geometry.getAttribute('normal');
    const normalsArray = normals ? normals.array as Float32Array : null;
    let avgNormal = faceNormal.clone();
    let normalCount = 0;

    if (normalsArray) {
      const tempNormal = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3(
          positionsArray[i * 3],
          positionsArray[i * 3 + 1],
          positionsArray[i * 3 + 2]
        );
        vertex.applyMatrix4(mesh.matrixWorld);

        const distance = vertex.distanceTo(point);
        if (distance < brushSize * 0.5) {
          tempNormal.set(
            normalsArray[i * 3],
            normalsArray[i * 3 + 1],
            normalsArray[i * 3 + 2]
          );
          tempNormal.transformDirection(mesh.matrixWorld);
          avgNormal.add(tempNormal);
          normalCount++;
        }
      }
      if (normalCount > 0) {
        avgNormal.divideScalar(normalCount);
        avgNormal.normalize();
      }
    }

    // Apply deformation
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positionsArray[i * 3],
        positionsArray[i * 3 + 1],
        positionsArray[i * 3 + 2]
      );
      vertex.applyMatrix4(mesh.matrixWorld);

      const distance = vertex.distanceTo(point);

      if (distance < brushSize) {
        const falloff = 1 - (distance / brushSize);
        const strength = brushStrength * falloff * falloff * 0.1;

        let direction: THREE.Vector3;
        let multiplier = strength;

        if (currentTool === 'push') {
          if (pushToolLastPoint.current) {
            direction = point.clone().sub(pushToolLastPoint.current);
            if (direction.length() < 0.001) continue;
            direction.normalize();
            const moveDistance = point.distanceTo(pushToolLastPoint.current);
            multiplier = strength * Math.min(moveDistance * 10, 2.0);
            if (isShiftPressed.current) multiplier = -multiplier;
          } else {
            continue;
          }
        } else {
          direction = avgNormal.clone();
          if (currentTool === 'subtract') {
            multiplier = -strength;
          }
          if (isShiftPressed.current) {
            multiplier = -multiplier;
          }
        }

        vertex.add(direction.multiplyScalar(multiplier));

        const invMatrix = mesh.matrixWorld.clone().invert();
        vertex.applyMatrix4(invMatrix);

        positionsArray[i * 3] = vertex.x;
        positionsArray[i * 3 + 1] = vertex.y;
        positionsArray[i * 3 + 2] = vertex.z;

        modified = true;
      }
    }

    if (modified) {
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }

    if (currentTool === 'push') {
      pushToolLastPoint.current = point.clone();
    }

    isProcessing.current = false;
    return modified;
  }, [isSelected, isSculptMode, brushSize, brushStrength, raycaster, camera, currentTool, meshRef, onGeometryUpdate]);

  return {
    isSculptMode,
    sculpt,
    resetPushTool,
    updateMousePosition,
  };
}