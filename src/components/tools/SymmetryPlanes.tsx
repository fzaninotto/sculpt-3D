import * as THREE from 'three';

interface SymmetryPlanesProps {
  symmetryAxes: { x: boolean; y: boolean; z: boolean };
  selectedObjectPosition?: [number, number, number];
  selectedObjectRotation?: [number, number, number];
  selectedObjectScale?: [number, number, number];
}

export function SymmetryPlanes({
  symmetryAxes,
  selectedObjectPosition = [0, 0, 0],
  selectedObjectRotation = [0, 0, 0],
  selectedObjectScale = [1, 1, 1]
}: SymmetryPlanesProps) {
  const planeSize = Math.max(...selectedObjectScale) * 5;

  return (
    <group position={selectedObjectPosition} rotation={selectedObjectRotation}>
      {symmetryAxes.x && (
        <mesh key="x-plane" rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[planeSize, planeSize]} />
          <meshBasicMaterial
            color={0x4a90e2}
            opacity={0.15}
            transparent={true}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {symmetryAxes.y && (
        <mesh key="y-plane" rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[planeSize, planeSize]} />
          <meshBasicMaterial
            color={0x4a90e2}
            opacity={0.15}
            transparent={true}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}

      {symmetryAxes.z && (
        <mesh key="z-plane">
          <planeGeometry args={[planeSize, planeSize]} />
          <meshBasicMaterial
            color={0x4a90e2}
            opacity={0.15}
            transparent={true}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}