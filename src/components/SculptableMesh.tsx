import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SculptableMeshProps {
  position?: [number, number, number];
  radius?: number;
  subdivisions?: number;
  brushSize?: number;
  brushStrength?: number;
}

export function SculptableMesh({
  position = [0, 0, 0],
  radius = 2,
  subdivisions = 5,
  brushSize = 0.5,
  brushStrength = 0.3,
}: SculptableMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { raycaster, mouse, camera } = useThree();
  const [isMouseDown, setIsMouseDown] = useState(false);
  const lastSculptTime = useRef(0);

  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(radius, subdivisions);
    geo.computeVertexNormals();
    return geo;
  }, [radius, subdivisions]);

  const sculpt = useCallback((mouseX: number, mouseY: number) => {
    if (!meshRef.current) return;

    const now = Date.now();
    // Throttle sculpting to 60fps
    if (now - lastSculptTime.current < 16) return;
    lastSculptTime.current = now;

    const mesh = meshRef.current;
    const geometry = mesh.geometry as THREE.BufferGeometry;

    // Update mouse position
    mouse.x = mouseX;
    mouse.y = mouseY;

    // Cast ray
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const point = intersection.point;
      const face = intersection.face;

      if (!face) return;

      // Get vertex positions
      const positions = geometry.getAttribute('position');
      const positionsArray = positions.array as Float32Array;

      // Deform vertices near the click point
      for (let i = 0; i < positions.count; i++) {
        const x = positionsArray[i * 3];
        const y = positionsArray[i * 3 + 1];
        const z = positionsArray[i * 3 + 2];

        const vertex = new THREE.Vector3(x, y, z);
        vertex.applyMatrix4(mesh.matrixWorld);

        const distance = vertex.distanceTo(point);

        if (distance < brushSize) {
          // Calculate falloff
          const falloff = 1 - (distance / brushSize);
          const strength = brushStrength * falloff * falloff * 0.1; // Reduced strength for continuous sculpting

          // Get normal at this vertex (approximate using face normal)
          const normal = face.normal.clone();
          normal.multiplyScalar(strength);

          // Transform back to local space
          const worldVertex = new THREE.Vector3(x, y, z);
          worldVertex.applyMatrix4(mesh.matrixWorld);
          worldVertex.add(normal);

          // Convert back to local coordinates
          const invMatrix = mesh.matrixWorld.clone().invert();
          worldVertex.applyMatrix4(invMatrix);

          positionsArray[i * 3] = worldVertex.x;
          positionsArray[i * 3 + 1] = worldVertex.y;
          positionsArray[i * 3 + 2] = worldVertex.z;
        }
      }

      // Update geometry
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
    }
  }, [raycaster, mouse, camera, brushSize, brushStrength]);

  // Handle mouse events
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (event.button === 0) {
        setIsMouseDown(true);
      }
    };

    const handleMouseUp = () => {
      setIsMouseDown(false);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (isMouseDown) {
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        sculpt(x, y);
      }
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isMouseDown, sculpt]);

  // Use frame for continuous sculpting when mouse is held down
  useFrame(() => {
    if (isMouseDown) {
      sculpt(mouse.x, mouse.y);
    }
  });

  return (
    <mesh ref={meshRef} position={position} geometry={geometry}>
      <meshStandardMaterial
        color="#8b7355"
        roughness={0.7}
        metalness={0.1}
      />
    </mesh>
  );
}