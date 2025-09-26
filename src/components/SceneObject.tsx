import { useRef, useState, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PrimitiveType } from '../types';
import { subdivideGeometryLocally } from '../utils/meshSubdivision';

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
  meshRef?: React.MutableRefObject<THREE.Mesh | null>;
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
  meshRef: externalMeshRef,
}: SceneObjectProps) {
  const internalMeshRef = useRef<THREE.Mesh>(null);
  const meshRef = externalMeshRef || internalMeshRef;
  const { raycaster, camera, gl } = useThree();
  const [isMouseDown, setIsMouseDown] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0 });
  const [geometryVersion, setGeometryVersion] = useState(0);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const lastSubdivisionTime = useRef(0);
  const isShiftPressed = useRef(false);
  const [isHovering, setIsHovering] = useState(false);
  const hoverPointRef = useRef<THREE.Vector3 | null>(null);
  const isProcessing = useRef(false); // Prevent concurrent operations

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

  // Update geometry ref when geometry changes
  useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);

  const sculpt = useCallback(() => {
    if (!meshRef.current || !isSelected || !isSculptMode || !isMouseDown) {
      return;
    }

    // Prevent concurrent processing
    if (isProcessing.current) {
      return;
    }

    isProcessing.current = true;

    const mesh = meshRef.current;
    let geo = mesh.geometry as THREE.BufferGeometry;

    // Create mouse vector
    const mouse = new THREE.Vector2(mouseRef.current.x, mouseRef.current.y);

    // Cast ray
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length > 0) {
      const intersection = intersects[0];
      const point = intersection.point;

      // ALWAYS subdivide FIRST before any vertex modification
      const now = Date.now();
      const shouldSubdivide = now - lastSubdivisionTime.current > 100;

      if (shouldSubdivide) {
        // Transform point to local space for subdivision
        const localPoint = point.clone();
        const invMatrix = mesh.matrixWorld.clone().invert();
        localPoint.applyMatrix4(invMatrix);

        // Subdivide geometry locally around the sculpting point
        const subdividedGeo = subdivideGeometryLocally(
          geo,
          localPoint,
          brushSize * 2.5, // Larger radius to catch edges of large triangles
          brushSize * 0.1 // Much smaller max edge length for finer detail
        );

        // Only update if subdivision actually created new vertices
        if (subdividedGeo.getAttribute('position').count > geo.getAttribute('position').count) {
          geo = subdividedGeo;
          mesh.geometry = geo;
          setGeometry(geo);
          lastSubdivisionTime.current = now;

          // IMPORTANT: Get fresh positions after subdivision
          const newPositions = geo.getAttribute('position');
          if (!newPositions) {
            isProcessing.current = false;
            return;
          }
        }
      }

      // Get vertex positions
      const positions = geo.getAttribute('position');
      if (!positions) return;

      const positionsArray = positions.array as Float32Array;
      let modified = false;

      // Get face normal from intersection
      const faceNormal = intersection.face ? intersection.face.normal.clone() : new THREE.Vector3(0, 1, 0);
      // Transform face normal to world space
      faceNormal.transformDirection(mesh.matrixWorld);
      faceNormal.normalize();

      // Calculate average normal for vertices in brush area (for smoother results)
      const normals = geo.getAttribute('normal');
      const normalsArray = normals ? normals.array as Float32Array : null;
      let avgNormal = faceNormal.clone();
      let normalCount = 0;

      if (normalsArray) {
        const tempNormal = new THREE.Vector3();
        for (let i = 0; i < positions.count; i++) {
          const x = positionsArray[i * 3];
          const y = positionsArray[i * 3 + 1];
          const z = positionsArray[i * 3 + 2];

          const vertex = new THREE.Vector3(x, y, z);
          vertex.applyMatrix4(mesh.matrixWorld);

          const distance = vertex.distanceTo(point);
          if (distance < brushSize * 0.5) {
            tempNormal.set(
              normalsArray[i * 3],
              normalsArray[i * 3 + 1],
              normalsArray[i * 3 + 2]
            );
            tempNormal.transformDirection(mesh.matrixWorld);
            avgNormal.add(tempNormal);
            normalCount++;
          }
        }
        if (normalCount > 0) {
          avgNormal.divideScalar(normalCount);
          avgNormal.normalize();
        }
      }

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

          // Use average normal for deformation direction
          const direction = avgNormal.clone();

          // Invert direction if shift is pressed (pull instead of push)
          const multiplier = isShiftPressed.current ? -strength : strength;

          // Apply deformation in world space
          vertex.add(direction.multiplyScalar(multiplier));

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

    // Clear processing flag
    isProcessing.current = false;
  }, [isSelected, isSculptMode, isMouseDown, brushSize, brushStrength, raycaster, camera]);

  // Handle keyboard events for shift modifier
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        isShiftPressed.current = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Shift') {
        isShiftPressed.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

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

      // Pre-subdivide on hover when in sculpt mode
      if (!isMouseDown && meshRef.current) {
        const mesh = meshRef.current;
        raycaster.setFromCamera(new THREE.Vector2(mouseRef.current.x, mouseRef.current.y), camera);
        const intersects = raycaster.intersectObject(mesh);

        if (intersects.length > 0) {
          setIsHovering(true);
          hoverPointRef.current = intersects[0].point;
        } else {
          setIsHovering(false);
          hoverPointRef.current = null;
        }
      }
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
  }, [isSculptMode, isSelected, gl, raycaster, camera]);

  // Sculpt on every frame while mouse is down, or pre-subdivide on hover
  useFrame(() => {
    if (isMouseDown && isSculptMode && isSelected) {
      sculpt();
    } else if (isHovering && isSculptMode && isSelected && !isMouseDown && hoverPointRef.current && meshRef.current && !isProcessing.current) {
      // Pre-subdivide on hover for smoother sculpting
      const now = Date.now();
      if (now - lastSubdivisionTime.current > 200) {
        isProcessing.current = true;
        const mesh = meshRef.current;
        const geo = mesh.geometry as THREE.BufferGeometry;

        // Transform hover point to local space
        const localPoint = hoverPointRef.current.clone();
        const invMatrix = mesh.matrixWorld.clone().invert();
        localPoint.applyMatrix4(invMatrix);

        // Pre-subdivide with tighter constraints
        const subdividedGeo = subdivideGeometryLocally(
          geo,
          localPoint,
          brushSize * 2, // Larger radius to catch edges of large triangles
          brushSize * 0.1 // Even finer detail for pre-subdivision
        );

        // Only update if subdivision actually created new vertices
        if (subdividedGeo.getAttribute('position').count > geo.getAttribute('position').count) {
          mesh.geometry = subdividedGeo;
          setGeometry(subdividedGeo);
          lastSubdivisionTime.current = now;
          setGeometryVersion(v => v + 1);
        }
        isProcessing.current = false;
      }
    }
  });

  const handlePointerDown = (e: any) => {
    if (!isSculptMode && e.button === 0) {
      e.stopPropagation();
      onSelect(id);
    }
  };

  return (
    <>
      <mesh
        ref={meshRef}
        position={position}
        rotation={rotation}
        scale={scale}
        geometry={geometry}
        onPointerDown={handlePointerDown}
      >
        <meshStandardMaterial
          color="#8b7355"
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>
      {isSelected && (
        <lineSegments
          key={`edges-${geometryVersion}`}
          position={position}
          rotation={rotation}
          scale={scale}
        >
          <edgesGeometry args={[geometry]} />
          <lineBasicMaterial color="#4a90e2" linewidth={2} />
        </lineSegments>
      )}
    </>
  );
}