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

  const getGroundIntersection = useCallback((event: MouseEvent) => {
    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
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

    const handleMouseMove = (event: MouseEvent) => {
      const currentPlacement = placementRef.current;
      if (currentPlacement.isPlacing && currentPlacement.startPoint) {
        const shiftPressed = event.shiftKey;
        const rect = gl.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
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

    const handleMouseUp = (event: MouseEvent) => {
      const currentPlacement = placementRef.current;
      if (event.button === 0 && currentPlacement.isPlacing && isActive) {
        event.preventDefault();
        event.stopPropagation();
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

    const canvas = gl.domElement;
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
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