import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ToolType } from '../types';

interface BrushPreviewProps {
  brushSize: number;
  isVisible: boolean;
  currentTool: ToolType;
  targetMesh?: THREE.Mesh | null;
}

interface AdjacencyData {
  vertexToFaces: Map<number, number[]>;
  faceNeighbors: Map<number, Set<number>>;
}

export function BrushPreview({ brushSize, isVisible, currentTool, targetMesh }: BrushPreviewProps) {
  // Determine brush color based on tool
  const getBrushColor = () => {
    switch (currentTool) {
      case 'add': return '#4a90e2'; // Blue for additive
      case 'subtract': return '#e24a4a'; // Red for subtractive
      case 'push': return '#e2a44a'; // Orange for push
      default: return '#4a90e2';
    }
  };
  const ringRef = useRef<THREE.Mesh>(null);
  const { raycaster, camera, gl } = useThree();
  const mouseRef = useRef({ x: 0, y: 0 });
  const adjacencyRef = useRef<AdjacencyData | null>(null);
  const lastGeometryId = useRef<number>(0);

  // Create ring geometry that lies in XZ plane (will be rotated to match surface)
  const ringGeometry = useMemo(() => {
    return new THREE.RingGeometry(brushSize * 0.95, brushSize, 32, 1);
  }, [brushSize]);

  // Build adjacency data structure for efficient vertex lookup
  const buildAdjacency = (geometry: THREE.BufferGeometry): AdjacencyData => {
    const indices = geometry.getIndex();
    if (!indices) return { vertexToFaces: new Map(), faceNeighbors: new Map() };

    const indexArray = indices.array;
    const vertexToFaces = new Map<number, number[]>();
    const faceNeighbors = new Map<number, Set<number>>();

    // Build vertex-to-faces map
    for (let i = 0; i < indexArray.length; i += 3) {
      const faceIndex = i / 3;
      const v0 = indexArray[i];
      const v1 = indexArray[i + 1];
      const v2 = indexArray[i + 2];

      // Add face to each vertex's list
      for (const v of [v0, v1, v2]) {
        if (!vertexToFaces.has(v)) {
          vertexToFaces.set(v, []);
        }
        vertexToFaces.get(v)!.push(faceIndex);
      }

      // Initialize face neighbors set
      if (!faceNeighbors.has(faceIndex)) {
        faceNeighbors.set(faceIndex, new Set());
      }
    }

    // Build face-to-face adjacency (faces that share at least one vertex)
    for (let i = 0; i < indexArray.length; i += 3) {
      const faceIndex = i / 3;
      const v0 = indexArray[i];
      const v1 = indexArray[i + 1];
      const v2 = indexArray[i + 2];

      const neighbors = faceNeighbors.get(faceIndex)!;

      // Find all faces that share vertices with this face
      for (const v of [v0, v1, v2]) {
        const faces = vertexToFaces.get(v) || [];
        for (const neighborFace of faces) {
          if (neighborFace !== faceIndex) {
            neighbors.add(neighborFace);
          }
        }
      }
    }

    return { vertexToFaces, faceNeighbors };
  };

  // Update adjacency when target mesh changes
  useEffect(() => {
    if (targetMesh?.geometry) {
      const geometryId = targetMesh.geometry.id;
      if (geometryId !== lastGeometryId.current) {
        adjacencyRef.current = buildAdjacency(targetMesh.geometry);
        lastGeometryId.current = geometryId;
      }
    }
  }, [targetMesh]);

  // Handle mouse move events
  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
    };
  }, [gl]);

  // Update position and orientation based on raycasting
  useFrame(() => {
    if (!isVisible || !ringRef.current) return;

    // Update position based on raycasting
    raycaster.setFromCamera(new THREE.Vector2(mouseRef.current.x, mouseRef.current.y), camera);

    if (targetMesh) {
      const intersects = raycaster.intersectObject(targetMesh);
      if (intersects.length > 0) {
        const intersection = intersects[0];
        const point = intersection.point.clone();
        const face = intersection.face;

        // Start with the face normal
        let surfaceNormal = face?.normal.clone() || new THREE.Vector3(0, 1, 0);
        surfaceNormal.transformDirection(targetMesh.matrixWorld);
        surfaceNormal.normalize();

        // If we have face data and adjacency, calculate more accurate normal
        if (face && adjacencyRef.current && targetMesh.geometry) {
          const geometry = targetMesh.geometry;
          const positions = geometry.getAttribute('position');
          const normals = geometry.getAttribute('normal');
          const indices = geometry.getIndex();

          if (positions && normals && indices) {
            const posArray = positions.array as Float32Array;
            const normArray = normals.array as Float32Array;
            const indexArray = indices.array;

            // Get the hit face's vertices
            const faceIndex = intersection.faceIndex!;
            const baseIdx = faceIndex * 3;
            const v0 = indexArray[baseIdx];
            const v1 = indexArray[baseIdx + 1];
            const v2 = indexArray[baseIdx + 2];

            // Transform intersection point to local space
            const localPoint = point.clone();
            const invMatrix = targetMesh.matrixWorld.clone().invert();
            localPoint.applyMatrix4(invMatrix);

            // Collect vertices to sample from hit face and neighbors
            const verticesToSample = new Set<number>();
            verticesToSample.add(v0);
            verticesToSample.add(v1);
            verticesToSample.add(v2);

            // Add vertices from neighboring faces
            const neighbors = adjacencyRef.current.faceNeighbors.get(faceIndex);
            if (neighbors) {
              for (const neighborIdx of neighbors) {
                const nBaseIdx = neighborIdx * 3;
                const nv0 = indexArray[nBaseIdx];
                const nv1 = indexArray[nBaseIdx + 1];
                const nv2 = indexArray[nBaseIdx + 2];

                // Check if any vertex of the neighbor face is within brush radius
                const tempVertex = new THREE.Vector3();
                for (const v of [nv0, nv1, nv2]) {
                  tempVertex.set(
                    posArray[v * 3],
                    posArray[v * 3 + 1],
                    posArray[v * 3 + 2]
                  );
                  if (tempVertex.distanceTo(localPoint) < brushSize * 1.2) {
                    verticesToSample.add(nv0);
                    verticesToSample.add(nv1);
                    verticesToSample.add(nv2);
                    break;
                  }
                }
              }
            }

            // Calculate weighted average normal from selected vertices
            let avgNormal = new THREE.Vector3();
            let totalWeight = 0;
            const tempVertex = new THREE.Vector3();
            const tempNormal = new THREE.Vector3();

            for (const vertexIdx of verticesToSample) {
              tempVertex.set(
                posArray[vertexIdx * 3],
                posArray[vertexIdx * 3 + 1],
                posArray[vertexIdx * 3 + 2]
              );

              const distance = tempVertex.distanceTo(localPoint);
              if (distance < brushSize * 1.2) {
                tempNormal.set(
                  normArray[vertexIdx * 3],
                  normArray[vertexIdx * 3 + 1],
                  normArray[vertexIdx * 3 + 2]
                );

                // Weight by distance (closer vertices have more influence)
                const weight = 1.0 - Math.min(distance / (brushSize * 1.2), 1.0);
                weight * weight; // Square for smoother falloff

                // Transform normal to world space
                tempNormal.transformDirection(targetMesh.matrixWorld);
                tempNormal.normalize();

                avgNormal.add(tempNormal.multiplyScalar(weight));
                totalWeight += weight;
              }
            }

            // Use weighted average if we have samples
            if (totalWeight > 0) {
              avgNormal.divideScalar(totalWeight);
              avgNormal.normalize();
              surfaceNormal = avgNormal;
            }
          }
        }

        // Position the ring slightly above the surface
        ringRef.current.position.copy(point.add(surfaceNormal.clone().multiplyScalar(0.01)));

        // Create rotation to align ring with surface normal
        const up = new THREE.Vector3(0, 0, 1);
        const quaternion = new THREE.Quaternion();
        quaternion.setFromUnitVectors(up, surfaceNormal);
        ringRef.current.quaternion.copy(quaternion);

        ringRef.current.visible = true;
      } else {
        ringRef.current.visible = false;
      }
    } else {
      ringRef.current.visible = false;
    }
  });

  if (!isVisible) return null;

  return (
    <group>
      {/* Main ring outline */}
      <mesh ref={ringRef} geometry={ringGeometry}>
        <meshBasicMaterial
          color={getBrushColor()}
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>

      {/* Center dot for precise positioning */}
      {ringRef.current && (
        <mesh
          position={ringRef.current.position}
          quaternion={ringRef.current.quaternion}
        >
          <circleGeometry args={[brushSize * 0.02, 16]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      )}
    </group>
  );
}