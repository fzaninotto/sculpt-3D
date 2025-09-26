import { useRef } from 'react';
import * as THREE from 'three';
import { Grid } from '@react-three/drei';
import { SceneObject } from '../objects/SceneObject';
import { BrushPreview } from '../tools/BrushPreview';
import { PlacementHandler } from '../objects/PlacementHandler';
import type { PrimitiveType, ToolType } from '../../types';

interface SceneObjectData {
  id: string;
  type: PrimitiveType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

interface SceneProps {
  objects: SceneObjectData[];
  selectedObjectId: string | null;
  currentTool: ToolType;
  selectedPrimitive: PrimitiveType;
  brushSize: number;
  brushStrength: number;
  selectedRenderMode: 'shaded' | 'mesh';
  onSelectObject: (id: string | null) => void;
  onPlaceObject: (type: PrimitiveType, position: [number, number, number], scale: number, rotation: [number, number, number]) => void;
  onPositionChange: (id: string, position: [number, number, number]) => void;
  onScaleChange: (id: string, scale: [number, number, number]) => void;
  onVertexCountUpdate: (objectId: string, count: number) => void;
}

function AxesHelper() {
  return <primitive object={new THREE.AxesHelper(100)} />;
}

export function Scene({
  objects,
  selectedObjectId,
  currentTool,
  selectedPrimitive,
  brushSize,
  brushStrength,
  selectedRenderMode,
  onSelectObject,
  onPlaceObject,
  onPositionChange,
  onScaleChange,
  onVertexCountUpdate,
}: SceneProps) {
  const selectedMeshRef = useRef<THREE.Mesh | null>(null);
  const isSculptingTool = ['add', 'subtract', 'push'].includes(currentTool);

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
          currentTool={currentTool}
          brushSize={brushSize}
          brushStrength={brushStrength}
          selectedRenderMode={obj.id === selectedObjectId ? selectedRenderMode : 'shaded'}
          onSelect={onSelectObject}
          onPositionChange={onPositionChange}
          onScaleChange={onScaleChange}
          meshRef={obj.id === selectedObjectId ? selectedMeshRef : undefined}
          onVertexCountUpdate={onVertexCountUpdate}
        />
      ))}

      <BrushPreview
        brushSize={brushSize}
        isVisible={isSculptingTool && selectedObjectId !== null}
        currentTool={currentTool}
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