import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { Scene } from './Scene';
import { Toolbar } from '../tools/Toolbar';
import { ObjectSidebar } from '../ui/ObjectSidebar';
import { SculptingControls } from '../ui/SculptingControls';
import { StatusOverlay } from '../ui/StatusOverlay';
import { UndoRedoControls } from '../ui/UndoRedoControls';
import { getOrbitDisablingTools } from '../../services/tools/toolDefinitions';
import { useSceneUndo } from '../../hooks/useSceneUndo';
import type { PrimitiveType, ToolType } from '../../types';

interface SceneObjectData {
  id: string;
  type: PrimitiveType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

export function ModelingCanvas() {
  // Controls and tools
  const controlsRef = useRef<any>(null);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('sphere');

  // Sculpting parameters
  const [brushSize, setBrushSize] = useState(0.5);
  const [brushStrength, setBrushStrength] = useState(0.5);
  const [symmetryAxes, setSymmetryAxes] = useState({ x: false, y: false, z: false });

  // Scene state
  const [objects, setObjects] = useState<SceneObjectData[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedRenderMode, setSelectedRenderMode] = useState<'shaded' | 'mesh'>('shaded');
  const [objectVertexCounts, setObjectVertexCounts] = useState<Record<string, number>>({});
  const [objectGeometries, setObjectGeometries] = useState<Record<string, THREE.BufferGeometry>>({});

  // Undo/Redo system
  const {
    saveCurrentState,
    requestStateSave,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
  } = useSceneUndo({
    objects,
    objectGeometries,
    selectedObjectId,
    setObjects,
    setObjectGeometries,
    setSelectedObjectId,
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Brush controls
      if (event.key === '[') {
        setBrushSize(prev => Math.max(0.1, prev - 0.1));
      } else if (event.key === ']') {
        setBrushSize(prev => Math.min(5, prev + 0.1));
      } else if (event.key === '{' || (event.shiftKey && event.key === '[')) {
        setBrushStrength(prev => Math.max(0.1, prev - 0.2));
      } else if (event.key === '}' || (event.shiftKey && event.key === ']')) {
        setBrushStrength(prev => Math.min(1.0, prev + 0.2));
      }
      // Symmetry shortcuts
      else if (event.key === 'x' && !event.ctrlKey && !event.metaKey) {
        setSymmetryAxes(prev => ({ ...prev, x: !prev.x }));
      } else if (event.key === 'y' && !event.ctrlKey && !event.metaKey) {
        setSymmetryAxes(prev => ({ ...prev, y: !prev.y }));
      } else if (event.key === 'z' && !event.ctrlKey && !event.metaKey) {
        setSymmetryAxes(prev => ({ ...prev, z: !prev.z }));
      }
      // Tool shortcuts
      else if (event.key === 's' && !event.ctrlKey && !event.metaKey) {
        setCurrentTool('select');
      } else if (event.key === 'a' && !event.ctrlKey && !event.metaKey) {
        setCurrentTool('add-primitive');
      } else if (event.key === 'b' && !event.ctrlKey && !event.metaKey) {
        setCurrentTool('add');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Object management callbacks
  const handlePlaceObject = useCallback((type: PrimitiveType, position: [number, number, number], scale: number, rotation: [number, number, number]) => {
    const newObject: SceneObjectData = {
      id: `object_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      position,
      rotation,
      scale: [scale, scale, scale],
    };
    setObjects(prev => [...prev, newObject]);
    setSelectedObjectId(newObject.id);
    setCurrentTool('add');

    // Mark that we need to save state after geometry is initialized
    requestStateSave();
  }, [requestStateSave]);

  const handleSelectObject = useCallback((id: string | null) => {
    if (currentTool === 'select') {
      setSelectedObjectId(id);
    } else if (id) {
      setSelectedObjectId(id);
    }
  }, [currentTool]);

  const handleDeleteObject = useCallback((id: string) => {
    // Save state before deletion
    saveCurrentState();

    setObjects(prev => prev.filter(obj => obj.id !== id));
    if (selectedObjectId === id) {
      setSelectedObjectId(null);
    }

    // Clean up geometry
    setObjectGeometries(prev => {
      const newGeometries = { ...prev };
      delete newGeometries[id];
      return newGeometries;
    });
  }, [selectedObjectId, saveCurrentState]);

  const handleObjectPositionChange = useCallback((id: string, position: [number, number, number]) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, position } : obj));
  }, []);

  const handleObjectRotationChange = useCallback((id: string, rotation: [number, number, number]) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, rotation } : obj));
  }, []);

  const handleObjectScaleChange = useCallback((id: string, scale: [number, number, number]) => {
    setObjects(prev => prev.map(obj => obj.id === id ? { ...obj, scale } : obj));
  }, []);

  const handleCanvasClick = useCallback((event: React.MouseEvent) => {
    if (currentTool === 'select' && event.target === event.currentTarget) {
      setSelectedObjectId(null);
    }
  }, [currentTool]);

  const orbitDisablingTools = getOrbitDisablingTools();

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Canvas
        camera={{ position: [10, 10, 10], fov: 50 }}
        onClick={handleCanvasClick}
      >
        <Scene
          objects={objects}
          objectGeometries={objectGeometries}
          selectedObjectId={selectedObjectId}
          currentTool={currentTool}
          selectedPrimitive={selectedPrimitive}
          brushSize={brushSize}
          brushStrength={brushStrength}
          symmetryAxes={symmetryAxes}
          selectedRenderMode={selectedRenderMode}
          onSelectObject={handleSelectObject}
          onPlaceObject={handlePlaceObject}
          onPositionChange={handleObjectPositionChange}
          onScaleChange={handleObjectScaleChange}
          onVertexCountUpdate={(objectId, count) => {
            setObjectVertexCounts(prev => ({ ...prev, [objectId]: count }));
          }}
          onGeometryUpdate={(objectId, geometry) => {
            setObjectGeometries(prev => ({ ...prev, [objectId]: geometry }));
          }}
          onRequestStateSave={saveCurrentState}
        />

        <OrbitControls
          ref={controlsRef}
          enablePan={true}
          enableRotate={true}
          enableZoom={true}
          mouseButtons={{
            LEFT: orbitDisablingTools.includes(currentTool) ? undefined : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.ROTATE,
            RIGHT: THREE.MOUSE.PAN
          }}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
          }}
        />

        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="black" />
        </GizmoHelper>
      </Canvas>

      {/* UI Components */}
      <UndoRedoControls
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <Toolbar
        currentTool={currentTool}
        selectedPrimitive={selectedPrimitive}
        selectedObjectId={selectedObjectId}
        onToolChange={setCurrentTool}
        onPrimitiveSelect={setSelectedPrimitive}
      />

      <ObjectSidebar
        selectedObjectId={selectedObjectId}
        objects={objects}
        selectedRenderMode={selectedRenderMode}
        objectVertexCounts={objectVertexCounts}
        onDeselectObject={() => setSelectedObjectId(null)}
        onDeleteObject={handleDeleteObject}
        onRenderModeChange={setSelectedRenderMode}
        onObjectPositionChange={handleObjectPositionChange}
        onObjectRotationChange={handleObjectRotationChange}
        onObjectScaleChange={handleObjectScaleChange}
      />

      <SculptingControls
        currentTool={currentTool}
        brushSize={brushSize}
        brushStrength={brushStrength}
        selectedObjectId={selectedObjectId}
        symmetryAxes={symmetryAxes}
        onBrushSizeChange={setBrushSize}
        onBrushStrengthChange={setBrushStrength}
        onSymmetryChange={(axis, enabled) => {
          setSymmetryAxes(prev => ({ ...prev, [axis]: enabled }));
        }}
      />

      <StatusOverlay
        currentTool={currentTool}
        selectedPrimitive={selectedPrimitive}
      />
    </div>
  );
}