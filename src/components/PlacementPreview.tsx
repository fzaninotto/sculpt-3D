import { useMemo } from 'react';
import * as THREE from 'three';
import type { PrimitiveType } from '../types';

interface PlacementPreviewProps {
  type: PrimitiveType;
  position: [number, number, number];
  scale: number;
  rotation: [number, number, number];
}

export function PlacementPreview({ type, position, scale, rotation }: PlacementPreviewProps) {
  const geometry = useMemo(() => {
    let geo: THREE.BufferGeometry;
    switch (type) {
      case 'sphere':
        geo = new THREE.IcosahedronGeometry(1, 2);
        break;
      case 'cube':
        geo = new THREE.BoxGeometry(1.5, 1.5, 1.5, 2, 2, 2);
        break;
      case 'cylinder':
        geo = new THREE.CylinderGeometry(0.7, 0.7, 2, 16, 2);
        break;
      case 'cone':
        geo = new THREE.ConeGeometry(1, 2, 16, 2);
        break;
      case 'torus':
        geo = new THREE.TorusGeometry(1, 0.4, 8, 16);
        break;
      default:
        geo = new THREE.IcosahedronGeometry(1, 2);
    }
    return geo;
  }, [type]);

  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={[scale, scale, scale]}
      geometry={geometry}
    >
      <meshStandardMaterial
        color="#4a90e2"
        opacity={0.5}
        transparent={true}
        roughness={0.7}
        metalness={0.1}
      />
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color="#ffffff" opacity={0.8} transparent={true} />
      </lineSegments>
    </mesh>
  );
}