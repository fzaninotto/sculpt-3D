import { useRef, useState, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PrimitiveType } from '../types';

interface SceneObjectProps {
  id: string;
  type: PrimitiveType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  isSelected: boolean;
  isSculptMode: boolean;
  brushSize: number;
  brushStrength: number;
  onSelect: (id: string) => void;
}

export function SceneObject({
  id,
  type,
  position,
  rotation,
  scale,
  isSelected,
  isSculptMode,
  brushSize,
  brushStrength,
  onSelect,
}: SceneObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { raycaster, camera, gl } = useThree();
  const [isMouseDown, setIsMouseDown] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [geometryVersion, setGeometryVersion] = useState(0);

  // Create geometry based on primitive type - use state so it can be modified
  const [geometry, setGeometry] = useState<THREE.BufferGeometry>(() => {
    // Calculate subdivision based on scale (larger = more detail)
    const avgScale = (scale[0] + scale[1] + scale[2]) / 3;
    const extraSubdivisions = Math.floor(avgScale * 2);

    let geo: THREE.BufferGeometry;
    switch (type) {
      case 'sphere':
        geo = new THREE.IcosahedronGeometry(1, Math.min(3 + extraSubdivisions, 7));
        break;
      case 'cube':
        const cubeSegs = Math.min(8 + extraSubdivisions * 3, 20);
        geo = new THREE.BoxGeometry(1.5, 1.5, 1.5, cubeSegs, cubeSegs, cubeSegs);
        break;
      case 'cylinder':
        const cylSegs = Math.min(24 + extraSubdivisions * 4, 64);
        const cylHeight = Math.min(8 + extraSubdivisions * 2, 20);
        geo = new THREE.CylinderGeometry(0.7, 0.7, 2, cylSegs, cylHeight);
        break;
      case 'cone':
        const coneSegs = Math.min(24 + extraSubdivisions * 4, 64);
        const coneHeight = Math.min(8 + extraSubdivisions * 2, 20);
        geo = new THREE.ConeGeometry(1, 2, coneSegs, coneHeight);
        break;
      case 'torus':
        const torusSegs = Math.min(12 + extraSubdivisions * 2, 32);
        const torusTube = Math.min(60 + extraSubdivisions * 10, 200);
        geo = new THREE.TorusGeometry(1, 0.4, torusSegs, torusTube);
        break;
      default:
        geo = new THREE.IcosahedronGeometry(1, Math.min(3 + extraSubdivisions, 7));
    }

    // Make sure position attribute is set up correctly
    const positions = geo.getAttribute('position');
    if (positions && 'setUsage' in positions) {
      (positions as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    }

    // Ensure geometry has indices for subdivision to work
    if (!geo.getIndex()) {
      const positions = geo.getAttribute('position');
      const indices: number[] = [];
      for (let i = 0; i < positions.count; i++) {
        indices.push(i);
      }
      geo.setIndex(indices);
    }

    geo.computeVertexNormals();
    geo.computeBoundingBox();
    geo.computeBoundingSphere();

    return geo;
  });

  const sculpt = useCallback(() => {
    if (!meshRef.current || !isSelected || !isSculptMode || !isMouseDown) return;

    const mesh = meshRef.current;
    const geo = mesh.geometry as THREE.BufferGeometry;

    // Create mouse vector
    const mouse = new THREE.Vector2(mouseRef.current.x, mouseRef.current.y);

    // Cast ray
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const point = intersection.point;

      // Get vertex positions
      const positions = geo.getAttribute('position');
      if (!positions) return;

      const positionsArray = positions.array as Float32Array;
      let modified = false;

      // Deform vertices near the click point
      for (let i = 0; i < positions.count; i++) {
        const x = positionsArray[i * 3];
        const y = positionsArray[i * 3 + 1];
        const z = positionsArray[i * 3 + 2];

        // Transform vertex to world space
        const vertex = new THREE.Vector3(x, y, z);
        vertex.applyMatrix4(mesh.matrixWorld);

        const distance = vertex.distanceTo(point);

        if (distance < brushSize) {
          // Calculate falloff
          const falloff = 1 - (distance / brushSize);
          const strength = brushStrength * falloff * falloff * 0.02; // Reduced for smoother sculpting

          // Calculate push direction (from intersection point outward)
          const direction = vertex.clone().sub(point).normalize();
          if (direction.length() === 0) {
            direction.set(0, 1, 0); // Default up if at exact point
          }

          // Apply deformation in world space
          vertex.add(direction.multiplyScalar(strength));

          // Convert back to local coordinates
          const invMatrix = mesh.matrixWorld.clone().invert();
          vertex.applyMatrix4(invMatrix);

          positionsArray[i * 3] = vertex.x;
          positionsArray[i * 3 + 1] = vertex.y;
          positionsArray[i * 3 + 2] = vertex.z;

          modified = true;
        }
      }

      // Update geometry if modified
      if (modified) {
        positions.needsUpdate = true;
        geo.computeVertexNormals();
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        // Force edge geometry update
        setGeometryVersion(v => v + 1);
      }
    }
  }, [isSelected, isSculptMode, isMouseDown, brushSize, brushStrength, raycaster, camera]);

  // Handle mouse events
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0 && isSculptMode && isSelected) {
        event.preventDefault();
        event.stopPropagation();
        setIsMouseDown(true);

        // Update mouse position
        const rect = canvas.getBoundingClientRect();
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      }
    };

    const handleMouseUp = () => {
      setIsMouseDown(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    if (isSculptMode && isSelected) {
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
  }, [isSculptMode, isSelected, gl]);

  // Sculpt on every frame while mouse is down
  useFrame(() => {
    if (isMouseDown && isSculptMode && isSelected) {
      sculpt();
    }
  });

  const handlePointerDown = (e: any) => {
    if (!isSculptMode && e.button === 0) {
      e.stopPropagation();
      onSelect(id);
    }
  };

  return (
    <mesh
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={scale}
      geometry={geometry}
      onPointerDown={handlePointerDown}
    >
      <meshStandardMaterial
        color={isSelected ? '#4a90e2' : '#8b7355'}
        roughness={0.7}
        metalness={0.1}
        emissive={isSelected ? '#4a90e2' : '#000000'}
        emissiveIntensity={isSelected ? 0.2 : 0}
      />
      {isSelected && (
        <lineSegments key={`edges-${geometryVersion}`}>
          <edgesGeometry args={[geometry]} />
          <lineBasicMaterial color="#ffffff" linewidth={1} />
        </lineSegments>
      )}
    </mesh>
  );
}