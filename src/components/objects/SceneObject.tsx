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
  const wireframeBackgroundMeshRef = useRef<THREE.Mesh>(null);
  const { gl } = useThree();
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Initialize geometry using ref for performance
  const geometryRef = useRef<THREE.BufferGeometry>(
    initialGeometry || PrimitiveFactory.createGeometry(type, scale)
  );
  const geometryVersionRef = useRef(0);
  const [geometryUpdateCounter, setGeometryUpdateCounter] = useState(0);

  const hasModifiedDuringStroke = useRef(false);

  // Set initial geometry on mount ONLY
  useEffect(() => {
    if (meshRef.current && geometryRef.current) {
      meshRef.current.geometry = geometryRef.current;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount, don't sync from props after that

  // Update geometry when initialGeometry prop changes (for undo/redo)
  useEffect(() => {
    if (initialGeometry && initialGeometry !== geometryRef.current) {
      geometryRef.current = initialGeometry;
      if (meshRef.current) {
        meshRef.current.geometry = initialGeometry;
        if (wireframeBackgroundMeshRef.current) {
          wireframeBackgroundMeshRef.current.geometry = initialGeometry;
        }
      }
      geometryVersionRef.current++;
      setGeometryUpdateCounter(c => c + 1);
    }
  }, [initialGeometry, meshRef]);

  // Report vertex count and geometry changes
  useEffect(() => {
    if (onVertexCountUpdate) {
      const vertexCount = geometryRef.current.getAttribute('position')?.count || 0;
      onVertexCountUpdate(id, vertexCount);
    }
    if (onGeometryUpdate) {
      onGeometryUpdate(id, geometryRef.current);
    }
  }, [geometryUpdateCounter, id, onVertexCountUpdate, onGeometryUpdate]);

  // Sculpting logic
  const { isSculptMode, sculpt, resetPushTool, updateMousePosition } = useSculpting({
    meshRef,
    currentTool,
    brushSize,
    brushStrength,
    symmetryAxes,
    isSelected,
    geometryVersionRef,
    onGeometryUpdate: (newGeometry, startingVersion) => {
      // Check for race condition before updating - use current ref value
      if (geometryVersionRef.current !== startingVersion) {
        // Race detected: discard this update
        return false;
      }

      // Update ref synchronously
      geometryRef.current = newGeometry;

      // CRITICAL: Update mesh.geometry IMMEDIATELY
      // Don't wait for React to re-render, as next frame will start before that happens
      if (meshRef.current) {
        meshRef.current.geometry = newGeometry;
        if (wireframeBackgroundMeshRef.current) {
          wireframeBackgroundMeshRef.current.geometry = newGeometry;
        }
      }

      // Increment version to trigger re-render for effects (vertex count updates, etc)
      geometryVersionRef.current++;
      setGeometryUpdateCounter(c => c + 1);

      return true;
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

    const handlePointerStart = (clientX: number, clientY: number) => {
      if (isSculptMode && isSelected) {
        // Reset modification tracking for this stroke
        hasModifiedDuringStroke.current = false;
        setIsMouseDown(true);

        const rect = canvas.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((clientY - rect.top) / rect.height) * 2 + 1;
        updateMousePosition(x, y);
      }
    };

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        event.preventDefault();
        event.stopPropagation();
        handlePointerStart(event.clientX, event.clientY);
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        event.stopPropagation();
        const touch = event.touches[0];
        handlePointerStart(touch.clientX, touch.clientY);
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

    const handlePointerMove = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        updateDrag(x, y);
      } else if (isSculptMode && isSelected) {
        updateMousePosition(x, y);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      handlePointerMove(event.clientX, event.clientY);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.touches.length === 1) {
        event.preventDefault();
        const touch = event.touches[0];
        handlePointerMove(touch.clientX, touch.clientY);
      }
    };

    const needsMouseEvents = (isSculptMode && isSelected) ||
                            (currentTool === 'move' || currentTool === 'scale');

    if (needsMouseEvents) {
      // Mouse events
      canvas.addEventListener('mousedown', handleMouseDown);
      canvas.addEventListener('mouseup', handleMouseUp);
      canvas.addEventListener('mouseleave', handleMouseUp);
      canvas.addEventListener('mousemove', handleMouseMove);

      // Touch events
      canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
      canvas.addEventListener('touchend', handleMouseUp);
      canvas.addEventListener('touchcancel', handleMouseUp);
      canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    return () => {
      // Remove mouse events
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);

      // Remove touch events
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleMouseUp);
      canvas.removeEventListener('touchcancel', handleMouseUp);
      canvas.removeEventListener('touchmove', handleTouchMove);
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

  // Ensure meshes get geometry when switching modes
  useEffect(() => {
    if (geometryRef.current) {
      if (meshRef.current) {
        meshRef.current.geometry = geometryRef.current;
      }
      if (showWireframe && wireframeBackgroundMeshRef.current) {
        wireframeBackgroundMeshRef.current.geometry = geometryRef.current;
      }
    }
  }, [showWireframe, showShaded, meshRef]);

  return (
    <>
      {showShaded && (
        <mesh
          ref={meshRef}
          position={position}
          rotation={rotation}
          scale={scale}
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
            ref={wireframeBackgroundMeshRef}
            position={position}
            rotation={rotation}
            scale={scale}
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