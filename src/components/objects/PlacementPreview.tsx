import { useMemo } from 'react';
import * as THREE from 'three';
import type { PrimitiveType } from '../../types';

interface PlacementPreviewProps {
  type: PrimitiveType;
  position: [number, number, number];
  scale: number;
  rotation: [number, number, number];
}

export function PlacementPreview({ type, position, scale, rotation }: PlacementPreviewProps) {
  const geometry = useMemo(() => {
    // Use adaptive subdivision for preview too
    const targetEdgeLength = 0.1; // Smaller target edge length for finer meshes

    let geo: THREE.BufferGeometry;
    switch (type) {
      case 'sphere': {
        const radius = scale;
        const circumference = 2 * Math.PI * radius;
        const widthSegments = Math.max(8, Math.min(128, Math.round(circumference / targetEdgeLength)));
        const heightSegments = Math.max(6, Math.min(64, Math.round(widthSegments / 2)));
        geo = new THREE.SphereGeometry(1, widthSegments, heightSegments);
        break;
      }
      case 'cube': {
        const size = scale * 1.5;
        const segments = Math.max(2, Math.min(32, Math.round(size / targetEdgeLength)));
        geo = new THREE.BoxGeometry(1.5, 1.5, 1.5, segments, segments, segments);
        break;
      }
      case 'cylinder': {
        const radius = scale * 0.7;
        const height = scale * 2;
        const radialSegments = Math.max(8, Math.min(64, Math.round(2 * Math.PI * radius / targetEdgeLength)));
        const heightSegments = Math.max(2, Math.min(32, Math.round(height / targetEdgeLength)));
        geo = new THREE.CylinderGeometry(0.7, 0.7, 2, radialSegments, heightSegments);
        break;
      }
      case 'cone': {
        const radius = scale * 1;
        const radialSegments = Math.max(8, Math.min(64, Math.round(2 * Math.PI * radius / targetEdgeLength)));
        const heightSegments = Math.max(2, Math.min(16, Math.round(2 / targetEdgeLength)));
        geo = new THREE.ConeGeometry(1, 2, radialSegments, heightSegments);
        break;
      }
      case 'torus': {
        const majorRadius = scale * 1;
        const minorRadius = scale * 0.4;
        const radialSegments = Math.max(6, Math.min(48, Math.round(2 * Math.PI * minorRadius / targetEdgeLength)));
        const tubularSegments = Math.max(8, Math.min(64, Math.round(2 * Math.PI * majorRadius / targetEdgeLength)));
        geo = new THREE.TorusGeometry(1, 0.4, radialSegments, tubularSegments);
        break;
      }
      default: {
        const radius = scale;
        const circumference = 2 * Math.PI * radius;
        const widthSegments = Math.max(8, Math.min(128, Math.round(circumference / targetEdgeLength)));
        const heightSegments = Math.max(6, Math.min(64, Math.round(widthSegments / 2)));
        geo = new THREE.SphereGeometry(1, widthSegments, heightSegments);
      }
    }
    return geo;
  }, [type, scale]);

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