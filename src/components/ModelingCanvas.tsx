import { useRef, useState, useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import * as THREE from 'three';
import { Toolbar } from './Toolbar';
import { SceneObject } from './SceneObject';
import { PlacementPreview } from './PlacementPreview';
import { BrushPreview } from './BrushPreview';
import type { PrimitiveType, ToolType } from '../types';

function AxesHelper() {
  return <primitive object={new THREE.AxesHelper(100)} />;
}

interface SceneObjectData {
  id: string;
  type: PrimitiveType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

interface PlacementData {
  isPlacing: boolean;
  startPoint: THREE.Vector3 | null;
  currentPoint: THREE.Vector3 | null;
  previewPosition: [number, number, number];
  previewScale: number;
  previewRotation: [number, number, number];
}

function PlacementHandler({
  isActive,
  selectedPrimitive,
  onPlaceObject,
}: {
  isActive: boolean;
  selectedPrimitive: PrimitiveType;
  onPlaceObject: (type: PrimitiveType, position: [number, number, number], scale: number, rotation: [number, number, number]) => void;
}) {
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
        // Check if shift key is held for straight shapes (no rotation)
        const shiftPressed = event.shiftKey;

        // Get mouse position in normalized device coordinates
        const rect = gl.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );

        // Create a ray from camera through mouse position
        raycaster.setFromCamera(mouse, camera);

        // Get a point along the ray at a distance proportional to the camera distance
        const cameraDistance = camera.position.distanceTo(currentPlacement.startPoint);
        const rayPoint = new THREE.Vector3();
        raycaster.ray.at(cameraDistance, rayPoint);

        // Calculate scale based on 2D distance on ground plane for stability
        const groundPoint = getGroundIntersection(event);
        const groundDistance = groundPoint ? currentPlacement.startPoint.distanceTo(groundPoint) : 1;
        const scale = Math.max(0.5, Math.min(groundDistance * 0.5, 5));

        let rotation: [number, number, number] = [0, 0, 0];

        // Only calculate rotation if shift key is NOT pressed
        if (!shiftPressed) {
          // Calculate drag vector in 3D space
          const dragVector = new THREE.Vector3(
            rayPoint.x - currentPlacement.startPoint.x,
            rayPoint.y - currentPlacement.startPoint.y,
            rayPoint.z - currentPlacement.startPoint.z
          );

          // Normalize drag vector for rotation
          if (dragVector.length() > 0.01) {
            dragVector.normalize();

            // Calculate rotation to point object along drag direction
            // For cones/cylinders, we want the tip/top to point along the drag
            const up = new THREE.Vector3(0, 1, 0);
            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(up, dragVector);

            // Convert to Euler angles
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

function Scene({
  objects,
  selectedObjectId,
  currentTool,
  selectedPrimitive,
  brushSize,
  brushStrength,
  selectedRenderMode,
  onSelectObject,
  onPlaceObject,
}: {
  objects: SceneObjectData[];
  selectedObjectId: string | null;
  currentTool: ToolType;
  selectedPrimitive: PrimitiveType;
  brushSize: number;
  brushStrength: number;
  selectedRenderMode: 'shaded' | 'mesh';
  onSelectObject: (id: string | null) => void;
  onPlaceObject: (type: PrimitiveType, position: [number, number, number], scale: number, rotation: [number, number, number]) => void;
}) {
  // Find the selected mesh for brush preview
  const selectedObject = objects.find(obj => obj.id === selectedObjectId);
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <Grid
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6f6f6f"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#9d9d9d"
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid
      />
      <AxesHelper />

      {objects.map((obj) => (
        <SceneObject
          key={obj.id}
          id={obj.id}
          type={obj.type}
          position={obj.position}
          rotation={obj.rotation}
          scale={obj.scale}
          isSelected={obj.id === selectedObjectId}
          isSculptMode={currentTool === 'sculpt'}
          brushSize={brushSize}
          brushStrength={brushStrength}
          selectedRenderMode={obj.id === selectedObjectId ? selectedRenderMode : 'shaded'}
          onSelect={onSelectObject}
          meshRef={obj.id === selectedObjectId ? selectedMeshRef : undefined}
        />
      ))}

      <BrushPreview
        brushSize={brushSize}
        isVisible={currentTool === 'sculpt' && selectedObjectId !== null}
        targetMesh={selectedMeshRef.current}
      />

      <PlacementHandler
        isActive={currentTool === 'add-primitive'}
        selectedPrimitive={selectedPrimitive}
        onPlaceObject={onPlaceObject}
      />
    </>
  );
}

export function ModelingCanvas() {
  const controlsRef = useRef<any>(null);
  const [brushSize, setBrushSize] = useState(0.5);
  const [brushStrength, setBrushStrength] = useState(0.5);
  const [currentTool, setCurrentTool] = useState<ToolType>('select');
  const [selectedPrimitive, setSelectedPrimitive] = useState<PrimitiveType>('sphere');
  const [objects, setObjects] = useState<SceneObjectData[]>([]);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedRenderMode, setSelectedRenderMode] = useState<'shaded' | 'mesh'>('shaded');

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Brush size controls
      if (event.key === '[') {
        setBrushSize(prev => Math.max(0.1, prev - 0.1));
      } else if (event.key === ']') {
        setBrushSize(prev => Math.min(2, prev + 0.1));
      }
      // Brush strength controls
      else if (event.key === '{' || (event.shiftKey && event.key === '[')) {
        setBrushStrength(prev => Math.max(0.1, prev - 0.2));
      } else if (event.key === '}' || (event.shiftKey && event.key === ']')) {
        setBrushStrength(prev => Math.min(1.0, prev + 0.2));
      }
      // Tool shortcuts
      else if (event.key === 's' && !event.ctrlKey && !event.metaKey) {
        setCurrentTool('select');
      } else if (event.key === 'a' && !event.ctrlKey && !event.metaKey) {
        setCurrentTool('add-primitive');
      } else if (event.key === 'b' && !event.ctrlKey && !event.metaKey) {
        setCurrentTool('sculpt');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handlePlaceObject = useCallback((type: PrimitiveType, position: [number, number, number], scale: number, rotation: [number, number, number]) => {
    const newObject: SceneObjectData = {
      id: Date.now().toString(),
      type,
      position,
      rotation,
      scale: [scale, scale, scale],
    };
    setObjects(prev => [...prev, newObject]);
    setSelectedObjectId(newObject.id);
    setCurrentTool('sculpt');
  }, []);

  const handleSelectObject = (id: string | null) => {
    if (currentTool === 'select') {
      setSelectedObjectId(id);
    }
  };

  const handleCanvasClick = (e: any) => {
    if (currentTool === 'select' && e.target === e.currentTarget) {
      setSelectedObjectId(null);
    }
  };

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Canvas
        camera={{ position: [10, 10, 10], fov: 50 }}
        onClick={handleCanvasClick}
      >
        <Scene
          objects={objects}
          selectedObjectId={selectedObjectId}
          currentTool={currentTool}
          selectedPrimitive={selectedPrimitive}
          brushSize={brushSize}
          brushStrength={brushStrength}
          selectedRenderMode={selectedRenderMode}
          onSelectObject={handleSelectObject}
          onPlaceObject={handlePlaceObject}
        />
        <OrbitControls
          ref={controlsRef}
          enablePan={true}
          enableRotate={true}
          enableZoom={true}
          mouseButtons={{
            LEFT: currentTool === 'sculpt' || currentTool === 'add-primitive' ? undefined : THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.ROTATE,
            RIGHT: THREE.MOUSE.PAN
          }}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
          }}
        />
        <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
          <GizmoViewport />
        </GizmoHelper>
      </Canvas>

      {/* Toolbar */}
      <Toolbar
        currentTool={currentTool}
        selectedPrimitive={selectedPrimitive}
        selectedRenderMode={selectedRenderMode}
        hasSelectedObject={selectedObjectId !== null}
        onToolChange={setCurrentTool}
        onPrimitiveSelect={setSelectedPrimitive}
        onRenderModeChange={setSelectedRenderMode}
      />

      {/* Sculpting Controls Panel */}
      {currentTool === 'sculpt' && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          color: 'white',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: '15px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          minWidth: '250px'
        }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '14px' }}>Sculpting Controls</h3>

          {!selectedObjectId && (
            <div style={{
              backgroundColor: 'rgba(255, 100, 100, 0.2)',
              padding: '10px',
              borderRadius: '4px',
              marginBottom: '15px',
              fontSize: '12px'
            }}>
              Select an object to sculpt
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
              Brush Size: {brushSize.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={brushSize}
              onChange={(e) => setBrushSize(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px' }}>
              Brush Strength: {brushStrength.toFixed(2)}
            </label>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.1"
              value={brushStrength}
              onChange={(e) => setBrushStrength(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}

      {/* Placement Instructions */}
      {currentTool === 'add-primitive' && (
        <div style={{
          position: 'absolute',
          top: 20,
          left: 20,
          color: 'white',
          backgroundColor: 'rgba(0,0,0,0.7)',
          padding: '15px',
          borderRadius: '8px',
          fontFamily: 'monospace',
          minWidth: '250px'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Place {selectedPrimitive}</h3>
          <div style={{ fontSize: '12px' }}>
            <div>1. Select shape from toolbar</div>
            <div>2. Click and drag to place</div>
            <div>3. Drag further for larger size</div>
          </div>
        </div>
      )}

      {/* Help Panel */}
      <div style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        color: 'white',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: '10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontFamily: 'monospace',
        opacity: 0.8
      }}>
        <div><strong>Current Tool:</strong> {currentTool.charAt(0).toUpperCase() + currentTool.slice(1).replace('-', ' ')}</div>
        <div style={{ marginTop: '5px' }}>
          {currentTool === 'select' && 'Click objects to select'}
          {currentTool === 'add-primitive' && `Click and drag to place ${selectedPrimitive}`}
          {currentTool === 'sculpt' && 'Hold left-click to sculpt • Hold Shift to pull'}
        </div>
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <div><strong>Camera Controls:</strong></div>
          <div>Middle Click: Rotate</div>
          <div>Right Click: Pan</div>
          <div>Scroll: Zoom</div>
        </div>
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <div><strong>Keyboard Shortcuts:</strong></div>
          <div>S: Select Tool</div>
          <div>A: Add Shape Tool</div>
          <div>B: Sculpt (Brush) Tool</div>
          <div>[ / ]: Brush Size -/+</div>
          <div>Shift+[ / ]: Strength -/+</div>
        </div>
      </div>
    </div>
  );
}