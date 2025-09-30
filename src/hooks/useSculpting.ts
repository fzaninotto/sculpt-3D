import { useRef, useCallback, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import type { ToolType } from '../types';
import { applySculptingStroke } from '../services/sculpting/sculptingEngine';

interface SculptingParams {
  meshRef: React.MutableRefObject<THREE.Mesh | null>;
  currentTool: ToolType;
  brushSize: number;
  brushStrength: number;
  symmetryAxes: { x: boolean; y: boolean; z: boolean };
  isSelected: boolean;
  geometryVersionRef: React.MutableRefObject<number>;
  onGeometryUpdate?: (geometry: THREE.BufferGeometry, startingVersion: number) => boolean;
}

export function useSculpting({
  meshRef,
  currentTool,
  brushSize,
  brushStrength,
  symmetryAxes,
  isSelected,
  geometryVersionRef,
  onGeometryUpdate,
}: SculptingParams) {
  const { raycaster, camera } = useThree();
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
    if (!meshRef.current || !isSelected || !isSculptMode) {
      return false;
    }

    const mesh = meshRef.current;

    // CRITICAL: Ensure mesh.geometry is in sync before reading
    // React might not have re-rendered yet, so mesh.geometry could be stale
    const geometry = mesh.geometry as THREE.BufferGeometry;

    // Capture starting version for race detection - use current ref value
    const startingVersion = geometryVersionRef.current;

    // Cast ray to find intersection point
    const mouse = new THREE.Vector2(mousePosition.current.x, mousePosition.current.y);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length === 0) {
      return false;
    }

    const intersection = intersects[0];
    const worldPoint = intersection.point;

    // Convert to local space
    const invMatrix = mesh.matrixWorld.clone().invert();
    const localClickPoint = worldPoint.clone().applyMatrix4(invMatrix);
    const localPreviousPoint = pushToolLastPoint.current
      ? pushToolLastPoint.current.clone().applyMatrix4(invMatrix)
      : null;

    // Check if we should subdivide (throttle)
    const now = Date.now();
    const shouldSubdivide = now - lastSubdivisionTime.current > 100;

    // Apply sculpting stroke using pure function
    const worldScale = mesh.scale.length() / Math.sqrt(3);
    const localBrushSize = brushSize / worldScale;

    const result = applySculptingStroke({
      geometry,
      clickPoint: localClickPoint,
      tool: currentTool,
      brushSize: localBrushSize,
      brushStrength,
      symmetryAxes,
      pushToolPreviousPoint: localPreviousPoint,
      invert: isShiftPressed.current,
      shouldSubdivide,
    });

    if (result.modified || result.geometry !== geometry) {
      // Call onGeometryUpdate with starting version for race detection
      // The callback will update both geometryRef.current AND mesh.geometry if no race
      const accepted = onGeometryUpdate?.(result.geometry, startingVersion) ?? true;

      if (accepted) {
        // Track subdivision for throttling
        if (result.geometry.getAttribute('position').count > geometry.getAttribute('position').count) {
          lastSubdivisionTime.current = now;
        }
      }
    }

    if (currentTool === 'push') {
      pushToolLastPoint.current = worldPoint.clone();
    }

    return result.modified;
  }, [
    isSelected,
    isSculptMode,
    brushSize,
    brushStrength,
    symmetryAxes,
    raycaster,
    camera,
    currentTool,
    meshRef,
    geometryVersionRef,
    onGeometryUpdate,
  ]);

  return {
    isSculptMode,
    sculpt,
    resetPushTool,
    updateMousePosition,
  };
}