import { useRef, useState, useEffect, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PrimitiveType, ToolType } from '../types';
import { subdivideGeometryLocally } from '../utils/meshSubdivision';

interface SceneObjectProps {
  id: string;
  type: PrimitiveType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  isSelected: boolean;
  currentTool: ToolType;
  brushSize: number;
  brushStrength: number;
  selectedRenderMode?: 'shaded' | 'mesh';
  onSelect: (id: string) => void;
  onPositionChange?: (id: string, position: [number, number, number]) => void;
  onScaleChange?: (id: string, scale: [number, number, number]) => void;
  meshRef?: React.MutableRefObject<THREE.Mesh | null>;
  onVertexCountUpdate?: (objectId: string, count: number) => void;
}

export function SceneObject({
  id,
  type,
  position,
  rotation,
  scale,
  isSelected,
  currentTool,
  brushSize,
  brushStrength,
  selectedRenderMode = 'shaded',
  onSelect,
  onPositionChange,
  onScaleChange,
  meshRef: externalMeshRef,
  onVertexCountUpdate,
}: SceneObjectProps) {
  // Determine if we're in a sculpting mode
  const isSculptMode = ['add', 'subtract', 'pinch'].includes(currentTool);

  // State for move/scale operations
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ mouse: { x: number, y: number }, position: [number, number, number], scale: [number, number, number] } | null>(null);
  const internalMeshRef = useRef<THREE.Mesh>(null);
  const meshRef = externalMeshRef || internalMeshRef;
  const { raycaster, camera, gl } = useThree();
  const [isMouseDown, setIsMouseDown] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0 });
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const lastSubdivisionTime = useRef(0);
  const isShiftPressed = useRef(false);
  const isProcessing = useRef(false); // Prevent concurrent operations

  // Create geometry based on primitive type - use state so it can be modified
  const [geometry, setGeometry] = useState<THREE.BufferGeometry>(() => {
    // Calculate adaptive subdivision based on object scale
    // Target edge length should be around 0.1 world units for good sculpting
    const avgScale = (scale[0] + scale[1] + scale[2]) / 3;
    const targetEdgeLength = 0.1; // Smaller target edge length for finer meshes

    let geo: THREE.BufferGeometry;
    switch (type) {
      case 'sphere': {
        // For sphere: circumference = 2πr, so edge length ≈ circumference / segments
        // segments = circumference / targetEdgeLength = 2πr / targetEdgeLength
        const radius = avgScale; // sphere radius in world units
        const circumference = 2 * Math.PI * radius;
        const widthSegments = Math.max(8, Math.min(128, Math.round(circumference / targetEdgeLength)));
        const heightSegments = Math.max(6, Math.min(64, Math.round(widthSegments / 2)));
        geo = new THREE.SphereGeometry(1, widthSegments, heightSegments);
        break;
      }
      case 'cube': {
        // For cube: edge length = size / segments
        const size = avgScale * 1.5; // cube is 1.5 units
        const segments = Math.max(2, Math.min(32, Math.round(size / targetEdgeLength)));
        geo = new THREE.BoxGeometry(1.5, 1.5, 1.5, segments, segments, segments);
        break;
      }
      case 'cylinder': {
        const radius = avgScale * 0.7;
        const height = avgScale * 2;
        const radialSegments = Math.max(8, Math.min(64, Math.round(2 * Math.PI * radius / targetEdgeLength)));
        const heightSegments = Math.max(2, Math.min(32, Math.round(height / targetEdgeLength)));
        geo = new THREE.CylinderGeometry(0.7, 0.7, 2, radialSegments, heightSegments);
        break;
      }
      case 'cone': {
        const radius = avgScale * 1;
        const radialSegments = Math.max(8, Math.min(64, Math.round(2 * Math.PI * radius / targetEdgeLength)));
        const heightSegments = Math.max(2, Math.min(16, Math.round(2 / targetEdgeLength)));
        geo = new THREE.ConeGeometry(1, 2, radialSegments, heightSegments);
        break;
      }
      case 'torus': {
        const majorRadius = avgScale * 1;
        const minorRadius = avgScale * 0.4;
        const radialSegments = Math.max(6, Math.min(48, Math.round(2 * Math.PI * minorRadius / targetEdgeLength)));
        const tubularSegments = Math.max(8, Math.min(64, Math.round(2 * Math.PI * majorRadius / targetEdgeLength)));
        geo = new THREE.TorusGeometry(1, 0.4, radialSegments, tubularSegments);
        break;
      }
      default: {
        const radius = avgScale;
        const circumference = 2 * Math.PI * radius;
        const widthSegments = Math.max(8, Math.min(128, Math.round(circumference / targetEdgeLength)));
        const heightSegments = Math.max(6, Math.min(64, Math.round(widthSegments / 2)));
        geo = new THREE.SphereGeometry(1, widthSegments, heightSegments);
      }
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

  // Update geometry ref when geometry changes and report vertex count
  useEffect(() => {
    geometryRef.current = geometry;
    if (onVertexCountUpdate) {
      const vertexCount = geometry.getAttribute('position')?.count || 0;
      onVertexCountUpdate(id, vertexCount);
    }
  }, [geometry, id, onVertexCountUpdate]);

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

        // Transform radius to local space as well
        const worldScale = mesh.scale.length() / Math.sqrt(3); // Average scale factor
        const localRadius = (brushSize * 1.5) / worldScale; // Larger to catch complete triangles
        const localMaxEdge = (brushSize * 0.25) / worldScale; // Finer subdivision for better quality

        // Subdivide geometry locally around the sculpting point
        const subdividedGeo = subdivideGeometryLocally(
          geo,
          localPoint,
          localRadius, // Larger area to ensure complete triangle coverage
          localMaxEdge // Finer subdivision to avoid thin triangles
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
          const strength = brushStrength * falloff * falloff * 0.1; // Increased for more visible sculpting effect

          // Calculate direction based on tool type
          let direction: THREE.Vector3;
          let multiplier = strength;

          if (currentTool === 'pinch') {
            // Pinch tool: move vertices toward brush center (radial displacement)
            direction = point.clone().sub(vertex).normalize();
            // For pinch, strength is always positive (pulling toward center)
            // Shift key can invert to push away from center
            if (isShiftPressed.current) {
              multiplier = -strength;
            }
          } else {
            // Normal sculpt/remove: use surface normal
            direction = avgNormal.clone();

            // Subtract tool inverts the direction (subtractive sculpting)
            if (currentTool === 'subtract') {
              multiplier = -strength;
            }

            // Shift key inverts the current direction
            if (isShiftPressed.current) {
              multiplier = -multiplier;
            }
          }

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
      if (isDragging) {
        setIsDragging(false);
        dragStartRef.current = null;
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Handle drag operations for move/scale tools
      if (isDragging && dragStartRef.current && isSelected) {
        const deltaX = mouseRef.current.x - dragStartRef.current.mouse.x;
        const deltaY = mouseRef.current.y - dragStartRef.current.mouse.y;

        if (currentTool === 'move') {
          // Calculate movement that scales properly with camera distance
          const objectPos = new THREE.Vector3(...dragStartRef.current.position);
          const cameraDistance = camera.position.distanceTo(objectPos);

          // Project object position to screen coordinates to get depth-correct scaling
          const screenVector = new THREE.Vector3();
          screenVector.copy(objectPos);
          screenVector.project(camera);

          // Calculate movement scaling based on camera distance and FOV
          let scaleFactor: number;
          if ('fov' in camera) {
            // Perspective camera
            const fov = camera.fov * Math.PI / 180; // Convert to radians
            scaleFactor = 2 * cameraDistance * Math.tan(fov / 2);
          } else {
            // Orthographic camera - use a simple scale factor
            scaleFactor = cameraDistance * 0.5;
          }

          // Get camera's right and up vectors in world space
          const cameraMatrix = camera.matrixWorld;
          const cameraRight = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 0);
          const cameraUp = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 1);

          // Calculate movement vector with proper scaling
          const movement = new THREE.Vector3()
            .addScaledVector(cameraRight, deltaX * scaleFactor)
            .addScaledVector(cameraUp, deltaY * scaleFactor);

          // Apply movement to original position
          const originalPos = new THREE.Vector3(...dragStartRef.current.position);
          const newPos = originalPos.add(movement);

          const newPosition: [number, number, number] = [newPos.x, newPos.y, newPos.z];
          onPositionChange?.(id, newPosition);
        } else if (currentTool === 'scale') {
          // Scale based on distance from center
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          const scaleFactor = Math.max(0.1, 1 + distance * (deltaY > 0 ? -1 : 1)); // Scale down when dragging down
          const newScale: [number, number, number] = [
            dragStartRef.current.scale[0] * scaleFactor,
            dragStartRef.current.scale[1] * scaleFactor,
            dragStartRef.current.scale[2] * scaleFactor
          ];
          onScaleChange?.(id, newScale);
        }
      }

    };

    // Attach mouse events for sculpting when selected, or always for move/scale tools
    const needsMouseEvents = (isSculptMode && isSelected) || (currentTool === 'move' || currentTool === 'scale');

    if (needsMouseEvents) {
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
  }, [currentTool, isSculptMode, isSelected, isDragging, gl, raycaster, camera]);

  // Sculpt on every frame while mouse is down
  useFrame(() => {
    if (isMouseDown && isSculptMode && isSelected) {
      sculpt();
    }
  });

  const handlePointerDown = (e: any) => {
    if (e.button === 0) {
      e.stopPropagation();

      if (currentTool === 'select') {
        onSelect(id);
      } else if (currentTool === 'move' || currentTool === 'scale') {
        // Select object and start drag operation immediately
        onSelect(id);

        const rect = gl.domElement.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        setIsDragging(true);
        dragStartRef.current = {
          mouse: { x: mouseX, y: mouseY },
          position: [...position],
          scale: [...scale]
        };
      } else if (!isSculptMode) {
        onSelect(id);
      }
    }
  };

  // Determine render mode
  const showShaded = !isSelected || (isSelected && selectedRenderMode === 'shaded');
  const showWireframe = isSelected && selectedRenderMode === 'mesh';

  return (
    <>
      {showShaded && (
        <mesh
          ref={meshRef}
          position={position}
          rotation={rotation}
          scale={scale}
          geometry={geometry}
          onPointerDown={handlePointerDown}
        >
          <meshStandardMaterial
            color={isSelected ? "#4a90e2" : "#8b7355"}
            roughness={0.7}
            metalness={0.1}
            flatShading={false}
          />
        </mesh>
      )}
      {showWireframe && (
        <>
          {/* First pass: Render invisible mesh to populate depth buffer */}
          <mesh
            position={position}
            rotation={rotation}
            scale={scale}
            geometry={geometry}
            renderOrder={1}
          >
            <meshBasicMaterial
              colorWrite={false}
              depthWrite={true}
              depthTest={true}
            />
          </mesh>

          {/* Second pass: Render wireframe that respects depth buffer */}
          <mesh
            ref={meshRef}
            position={position}
            rotation={rotation}
            scale={scale}
            geometry={geometry}
            onPointerDown={handlePointerDown}
            renderOrder={2}
          >
            <meshBasicMaterial
              color="#4a90e2"
              wireframe={true}
              depthTest={true}
              depthWrite={false}
            />
          </mesh>
        </>
      )}
    </>
  );
}