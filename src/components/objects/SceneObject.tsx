import { useRef, useState, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PrimitiveType, ToolType } from '../../types';
import { PrimitiveFactory } from '../../services/geometry/primitiveFactory';
import { useSculpting } from '../../hooks/useSculpting';
import { useObjectManipulation } from '../../hooks/useObjectManipulation';

interface SceneObjectProps {
  id: string;
  type: PrimitiveType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  initialGeometry?: THREE.BufferGeometry;
  isSelected: boolean;
  currentTool: ToolType;
  brushSize: number;
  brushStrength: number;
  symmetryAxes: { x: boolean; y: boolean; z: boolean };
  selectedRenderMode?: 'shaded' | 'mesh';
  onSelect: (id: string) => void;
  onPositionChange?: (id: string, position: [number, number, number]) => void;
  onScaleChange?: (id: string, scale: [number, number, number]) => void;
  meshRef?: React.MutableRefObject<THREE.Mesh | null>;
  onVertexCountUpdate?: (objectId: string, count: number) => void;
  onGeometryUpdate?: (objectId: string, geometry: THREE.BufferGeometry) => void;
  onRequestStateSave?: () => void;
}

export function SceneObject({
  id,
  type,
  position,
  rotation,
  scale,
  initialGeometry,
  isSelected,
  currentTool,
  brushSize,
  brushStrength,
  symmetryAxes,
  selectedRenderMode = 'shaded',
  onSelect,
  onPositionChange,
  onScaleChange,
  meshRef: externalMeshRef,
  onVertexCountUpdate,
  onGeometryUpdate,
  onRequestStateSave,
}: SceneObjectProps) {
  const internalMeshRef = useRef<THREE.Mesh>(null);
  const meshRef = externalMeshRef || internalMeshRef;
  const { gl } = useThree();
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Initialize geometry
  const [geometry, setGeometry] = useState<THREE.BufferGeometry>(() =>
    initialGeometry || PrimitiveFactory.createGeometry(type, scale)
  );

  const hasModifiedDuringStroke = useRef(false);

  // Update geometry when initialGeometry prop changes (e.g., during undo/redo)
  useEffect(() => {
    if (initialGeometry) {
      setGeometry(initialGeometry.clone());
    }
  }, [initialGeometry]);

  // Report vertex count and geometry changes
  useEffect(() => {
    if (onVertexCountUpdate) {
      const vertexCount = geometry.getAttribute('position')?.count || 0;
      onVertexCountUpdate(id, vertexCount);
    }
    if (onGeometryUpdate) {
      onGeometryUpdate(id, geometry);
    }
  }, [geometry, id, onVertexCountUpdate, onGeometryUpdate]);

  // Sculpting logic
  const { isSculptMode, sculpt, resetPushTool, updateMousePosition } = useSculpting({
    meshRef,
    currentTool,
    brushSize,
    brushStrength,
    symmetryAxes,
    isSelected,
    onGeometryUpdate: (newGeometry) => {
      setGeometry(newGeometry);
    },
  });

  // Object manipulation (move/scale)
  const {
    isDragging,
    startDrag,
    endDrag,
    updateDrag,
  } = useObjectManipulation({
    id,
    position,
    scale,
    currentTool,
    onPositionChange,
    onScaleChange,
  });

  // Handle mouse events
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0 && isSculptMode && isSelected) {
        event.preventDefault();
        event.stopPropagation();

        // Reset modification tracking for this stroke
        hasModifiedDuringStroke.current = false;
        setIsMouseDown(true);

        const rect = canvas.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        updateMousePosition(x, y);
      }
    };

    const handleMouseUp = () => {
      // Check if we were sculpting BEFORE clearing the flag
      const wasSculpting = isMouseDown && isSculptMode && isSelected;
      const didModify = hasModifiedDuringStroke.current;

      // Clear state flags
      setIsMouseDown(false);
      hasModifiedDuringStroke.current = false;

      if (isDragging) {
        endDrag();
      }
      resetPushTool();

      // Request state save AFTER completing a stroke that made modifications
      if (wasSculpting && didModify && onRequestStateSave) {
        onRequestStateSave();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        updateDrag(x, y);
      } else if (isSculptMode && isSelected) {
        updateMousePosition(x, y);
      }
    };

    const needsMouseEvents = (isSculptMode && isSelected) ||
                            (currentTool === 'move' || currentTool === 'scale');

    if (needsMouseEvents) {
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('mouseleave', handleMouseUp);
      canvas.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [currentTool, isSculptMode, isSelected, isDragging, gl, endDrag, resetPushTool, updateMousePosition, updateDrag, id, onRequestStateSave, isMouseDown]);

  // Sculpt on every frame while mouse is down
  useFrame(() => {
    if (isMouseDown && isSculptMode && isSelected) {
      const didModify = sculpt();
      if (didModify) {
        hasModifiedDuringStroke.current = true;
      }
    }
  });

  const handlePointerDown = useCallback((e: any) => {
    if (e.button === 0) {
      e.stopPropagation();

      if (currentTool === 'select') {
        onSelect(id);
      } else if (currentTool === 'move' || currentTool === 'scale') {
        onSelect(id);
        startDrag(e);
      } else if (!isSculptMode) {
        onSelect(id);
      }
    }
  }, [currentTool, isSculptMode, id, onSelect, startDrag]);

  // Render modes
  const showShaded = !isSelected || (isSelected && selectedRenderMode === 'shaded');
  const showWireframe = isSelected && selectedRenderMode === 'mesh';

  return (
    <>
      {showShaded && (
        <mesh
          ref={meshRef}
          position={position}
          rotation={rotation}
          scale={scale}
          geometry={geometry}
          onPointerDown={handlePointerDown}
        >
          <meshStandardMaterial
            color={isSelected ? "#4a90e2" : "#8b7355"}
            roughness={0.7}
            metalness={0.1}
            flatShading={false}
          />
        </mesh>
      )}
      {showWireframe && (
        <>
          <mesh
            position={position}
            rotation={rotation}
            scale={scale}
            geometry={geometry}
            renderOrder={1}
          >
            <meshBasicMaterial
              colorWrite={false}
              depthWrite={true}
              depthTest={true}
            />
          </mesh>
          <mesh
            ref={meshRef}
            position={position}
            rotation={rotation}
            scale={scale}
            geometry={geometry}
            onPointerDown={handlePointerDown}
            renderOrder={2}
          >
            <meshBasicMaterial
              color="#4a90e2"
              wireframe={true}
              depthTest={true}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
    </>
  );
}