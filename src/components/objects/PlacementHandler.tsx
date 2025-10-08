import { useState, useRef, useEffect, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PlacementPreview } from './PlacementPreview';
import type { PrimitiveType } from '../../types';

interface PlacementData {
  isPlacing: boolean;
  startPoint: THREE.Vector3 | null;
  currentPoint: THREE.Vector3 | null;
  previewPosition: [number, number, number];
  previewScale: number;
  previewRotation: [number, number, number];
}

interface PlacementHandlerProps {
  isActive: boolean;
  selectedPrimitive: PrimitiveType;
  onPlaceObject: (type: PrimitiveType, position: [number, number, number], scale: number, rotation: [number, number, number]) => void;
}

export function PlacementHandler({
  isActive,
  selectedPrimitive,
  onPlaceObject,
}: PlacementHandlerProps) {
  const { raycaster, camera, gl } = useThree();
  const [placement, setPlacement] = useState<PlacementData>({
    isPlacing: false,
    startPoint: null,
    currentPoint: null,
    previewPosition: [0, 0, 0],
    previewScale: 1,
    previewRotation: [0, 0, 0],
  });

  // Use a ref to access placement in event handlers without causing re-renders
  const placementRef = useRef(placement);
  useEffect(() => {
    placementRef.current = placement;
  }, [placement]);

  const getGroundIntersection = useCallback((event: MouseEvent | TouchEvent) => {
    const rect = gl.domElement.getBoundingClientRect();

    // Extract client coordinates from mouse or touch event
    let clientX: number;
    let clientY: number;

    if ('touches' in event) {
      // Touch event
      if (event.touches.length === 0) return null;
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      // Mouse event
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.setFromCamera(mouse, camera);

    // Create a plane at y=0 for ground intersection
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersection);

    return intersection;
  }, [raycaster, camera, gl]);

  useEffect(() => {
    if (!isActive) {
      setPlacement({
        isPlacing: false,
        startPoint: null,
        currentPoint: null,
        previewPosition: [0, 0, 0],
        previewScale: 1,
        previewRotation: [0, 0, 0],
      });
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0 && isActive) {
        event.preventDefault();
        event.stopPropagation();
        const point = getGroundIntersection(event);
        if (point) {
          setPlacement({
            isPlacing: true,
            startPoint: point,
            currentPoint: point,
            previewPosition: [point.x, point.y + 0.1, point.z],
            previewScale: 0.1,
            previewRotation: [0, 0, 0],
          });
        }
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (isActive && event.touches.length === 1) {
        event.preventDefault();
        event.stopPropagation();
        const point = getGroundIntersection(event);
        if (point) {
          setPlacement({
            isPlacing: true,
            startPoint: point,
            currentPoint: point,
            previewPosition: [point.x, point.y + 0.1, point.z],
            previewScale: 0.1,
            previewRotation: [0, 0, 0],
          });
        }
      }
    };

    const handlePointerMove = (event: MouseEvent | TouchEvent) => {
      const currentPlacement = placementRef.current;
      if (currentPlacement.isPlacing && currentPlacement.startPoint) {
        const shiftPressed = 'shiftKey' in event ? event.shiftKey : false;
        const rect = gl.domElement.getBoundingClientRect();

        // Extract coordinates from mouse or touch event
        let clientX: number;
        let clientY: number;
        if ('touches' in event) {
          if (event.touches.length === 0) return;
          clientX = event.touches[0].clientX;
          clientY = event.touches[0].clientY;
        } else {
          clientX = event.clientX;
          clientY = event.clientY;
        }

        const mouse = new THREE.Vector2(
          ((clientX - rect.left) / rect.width) * 2 - 1,
          -((clientY - rect.top) / rect.height) * 2 + 1
        );

        raycaster.setFromCamera(mouse, camera);
        const cameraDistance = camera.position.distanceTo(currentPlacement.startPoint);
        const rayPoint = new THREE.Vector3();
        raycaster.ray.at(cameraDistance, rayPoint);

        const groundPoint = getGroundIntersection(event);
        const groundDistance = groundPoint ? currentPlacement.startPoint.distanceTo(groundPoint) : 1;
        const scale = Math.max(0.5, Math.min(groundDistance * 0.5, 5));

        let rotation: [number, number, number] = [0, 0, 0];

        if (!shiftPressed) {
          const dragVector = new THREE.Vector3(
            rayPoint.x - currentPlacement.startPoint.x,
            rayPoint.y - currentPlacement.startPoint.y,
            rayPoint.z - currentPlacement.startPoint.z
          );

          if (dragVector.length() > 0.01) {
            dragVector.normalize();
            const up = new THREE.Vector3(0, 1, 0);
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(up, dragVector);
            const euler = new THREE.Euler();
            euler.setFromQuaternion(quaternion, 'XYZ');
            rotation = [euler.x, euler.y, euler.z];
          }
        }

        setPlacement(prev => ({
          ...prev,
          currentPoint: rayPoint,
          previewPosition: [currentPlacement.startPoint!.x, currentPlacement.startPoint!.y + scale * 0.5, currentPlacement.startPoint!.z],
          previewScale: scale,
          previewRotation: rotation,
        }));
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      handlePointerMove(event);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        handlePointerMove(event);
      }
    };

    const handlePointerEnd = () => {
      const currentPlacement = placementRef.current;
      if (currentPlacement.isPlacing && isActive) {
        const { previewPosition, previewScale, previewRotation } = currentPlacement;
        if (previewScale > 0.3) {
          onPlaceObject(selectedPrimitive, previewPosition, previewScale, previewRotation);
        }
        setPlacement({
          isPlacing: false,
          startPoint: null,
          currentPoint: null,
          previewPosition: [0, 0, 0],
          previewScale: 1,
          previewRotation: [0, 0, 0],
        });
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) {
        event.preventDefault();
        event.stopPropagation();
        handlePointerEnd();
      }
    };

    const handleTouchEnd = (event: TouchEvent) => {
      event.preventDefault();
      event.stopPropagation();
      handlePointerEnd();
    };

    const canvas = gl.domElement;
    // Mouse events
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);

    // Touch events
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      // Remove mouse events
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);

      // Remove touch events
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isActive, selectedPrimitive, getGroundIntersection, onPlaceObject, gl]);

  if (!isActive || !placement.isPlacing) return null;

  return (
    <PlacementPreview
      type={selectedPrimitive}
      position={placement.previewPosition}
      scale={placement.previewScale}
      rotation={placement.previewRotation}
    />
  );
}