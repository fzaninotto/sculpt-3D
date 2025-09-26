import { useState, useRef, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ToolType } from '../types';

interface ManipulationParams {
  id: string;
  position: [number, number, number];
  scale: [number, number, number];
  currentTool: ToolType;
  onPositionChange?: (id: string, position: [number, number, number]) => void;
  onScaleChange?: (id: string, scale: [number, number, number]) => void;
}

export function useObjectManipulation({
  id,
  position,
  scale,
  currentTool,
  onPositionChange,
  onScaleChange,
}: ManipulationParams) {
  const { camera, gl } = useThree();
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    mouse: { x: number; y: number };
    position: [number, number, number];
    scale: [number, number, number];
  } | null>(null);

  const startDrag = useCallback((event: MouseEvent | PointerEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    const mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    setIsDragging(true);
    dragStartRef.current = {
      mouse: { x: mouseX, y: mouseY },
      position: [...position],
      scale: [...scale],
    };
  }, [gl.domElement, position, scale]);

  const endDrag = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  const updateDrag = useCallback((mouseX: number, mouseY: number) => {
    if (!isDragging || !dragStartRef.current) return;

    const deltaX = mouseX - dragStartRef.current.mouse.x;
    const deltaY = mouseY - dragStartRef.current.mouse.y;

    if (currentTool === 'move') {
      // Calculate movement in 3D space relative to camera
      const objectPos = new THREE.Vector3(...dragStartRef.current.position);
      const cameraDistance = camera.position.distanceTo(objectPos);

      // Calculate movement scaling based on camera distance and FOV
      let scaleFactor: number;
      if ('fov' in camera) {
        const fov = camera.fov * Math.PI / 180;
        scaleFactor = 2 * cameraDistance * Math.tan(fov / 2);
      } else {
        scaleFactor = cameraDistance * 0.5;
      }

      // Get camera's right and up vectors in world space
      const cameraMatrix = camera.matrixWorld;
      const cameraRight = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 0);
      const cameraUp = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 1);

      // Calculate movement vector with proper scaling
      const movement = new THREE.Vector3()
        .addScaledVector(cameraRight, deltaX * scaleFactor)
        .addScaledVector(cameraUp, deltaY * scaleFactor);

      // Apply movement to original position
      const originalPos = new THREE.Vector3(...dragStartRef.current.position);
      const newPos = originalPos.add(movement);

      onPositionChange?.(id, [newPos.x, newPos.y, newPos.z]);
    } else if (currentTool === 'scale') {
      // Scale based on vertical mouse movement
      const scaleDelta = 1 + deltaY * 2;
      const newScale = Math.max(0.1, dragStartRef.current.scale[0] * scaleDelta);

      onScaleChange?.(id, [newScale, newScale, newScale]);
    }
  }, [isDragging, currentTool, camera, id, onPositionChange, onScaleChange]);

  return {
    isDragging,
    startDrag,
    endDrag,
    updateDrag,
  };
}