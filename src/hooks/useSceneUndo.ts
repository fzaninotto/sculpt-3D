import { useState, useCallback, useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { PrimitiveType } from '../types';

export interface SceneObjectState {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  geometry?: THREE.BufferGeometry;
}

interface SceneObjectData {
  id: string;
  type: PrimitiveType;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

interface GlobalState {
  objects: SceneObjectState[];
  selectedObjectId: string | null;
  timestamp: number;
}

interface UseSceneUndoParams {
  objects: SceneObjectData[];
  objectGeometries: Record<string, THREE.BufferGeometry>;
  selectedObjectId: string | null;
  setObjects: React.Dispatch<React.SetStateAction<SceneObjectData[]>>;
  setObjectGeometries: React.Dispatch<React.SetStateAction<Record<string, THREE.BufferGeometry>>>;
  setSelectedObjectId: React.Dispatch<React.SetStateAction<string | null>>;
  maxHistorySize?: number;
}

export function useSceneUndo({
  objects,
  objectGeometries,
  selectedObjectId,
  setObjects,
  setObjectGeometries,
  setSelectedObjectId,
  maxHistorySize = 50,
}: UseSceneUndoParams) {
  const [, forceUpdate] = useState(0);
  const currentIndexRef = useRef(-1);
  const history = useRef<GlobalState[]>([]);
  const needsSave = useRef(false);
  const hasInitialSave = useRef(false);

  // Core undo/redo functionality
  const saveState = useCallback((objectStates: SceneObjectState[], selectedId: string | null) => {
    // Clone all objects and their geometries
    const clonedObjects = objectStates.map(obj => ({
      ...obj,
      geometry: obj.geometry ? obj.geometry.clone() : undefined
    }));

    // Remove any states after current index (when we save after undoing)
    if (currentIndexRef.current < history.current.length - 1) {
      history.current = history.current.slice(0, currentIndexRef.current + 1);
    }

    // Add new state
    history.current.push({
      objects: clonedObjects,
      selectedObjectId: selectedId,
      timestamp: Date.now()
    });

    // Limit history size
    if (history.current.length > maxHistorySize) {
      history.current.shift();
    } else {
      currentIndexRef.current = history.current.length - 1;
    }

    forceUpdate(prev => prev + 1);
  }, [maxHistorySize]);

  // Helper to save current state
  const saveCurrentState = useCallback(() => {
    const objectsWithGeometry = objects.map(obj => ({
      ...obj,
      geometry: objectGeometries[obj.id]
    }));
    saveState(objectsWithGeometry, selectedObjectId);
  }, [objects, objectGeometries, selectedObjectId, saveState]);

  // Mark that we need to save state (used after object creation)
  const requestStateSave = useCallback(() => {
    needsSave.current = true;
  }, []);

  // Handle undo
  const handleUndo = useCallback(() => {
    if (currentIndexRef.current > 0) {
      const newIndex = currentIndexRef.current - 1;
      currentIndexRef.current = newIndex;
      forceUpdate(prev => prev + 1);

      // Clone geometries when restoring
      const state = history.current[newIndex];

      setObjects(state.objects.map(obj => ({
        id: obj.id,
        type: obj.type as PrimitiveType,
        position: obj.position,
        rotation: obj.rotation,
        scale: obj.scale
      })));

      const newGeometries: Record<string, THREE.BufferGeometry> = {};
      state.objects.forEach(obj => {
        if (obj.geometry) {
          newGeometries[obj.id] = obj.geometry.clone();
        }
      });
      setObjectGeometries(newGeometries);
      setSelectedObjectId(state.selectedObjectId);
    }
  }, [setObjects, setObjectGeometries, setSelectedObjectId]);

  // Handle redo
  const handleRedo = useCallback(() => {
    if (currentIndexRef.current < history.current.length - 1) {
      const newIndex = currentIndexRef.current + 1;
      currentIndexRef.current = newIndex;
      forceUpdate(prev => prev + 1);

      // Clone geometries when restoring
      const state = history.current[newIndex];

      setObjects(state.objects.map(obj => ({
        id: obj.id,
        type: obj.type as PrimitiveType,
        position: obj.position,
        rotation: obj.rotation,
        scale: obj.scale
      })));

      const newGeometries: Record<string, THREE.BufferGeometry> = {};
      state.objects.forEach(obj => {
        if (obj.geometry) {
          newGeometries[obj.id] = obj.geometry.clone();
        }
      });
      setObjectGeometries(newGeometries);
      setSelectedObjectId(state.selectedObjectId);
    }
  }, [setObjects, setObjectGeometries, setSelectedObjectId]);

  // Save initial state on mount
  useEffect(() => {
    if (!hasInitialSave.current && objects.length === 0) {
      hasInitialSave.current = true;
      // Save an empty initial state
      saveState([], null);
    }
  }, [saveState, objects.length]);

  // Save state when a new object is created and its geometry is initialized
  useEffect(() => {
    if (needsSave.current && objects.length > 0) {
      // Check if all objects have their geometry initialized
      const allGeometriesReady = objects.every(obj => objectGeometries[obj.id]);
      if (allGeometriesReady) {
        needsSave.current = false;
        saveCurrentState();
      }
    }
  }, [objects, objectGeometries, saveCurrentState]);

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.key === 'z' || event.key === 'Z') && (event.ctrlKey || event.metaKey)) {
        if (event.shiftKey) {
          // Redo
          handleRedo();
        } else {
          // Undo
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const canUndo = currentIndexRef.current > 0;
  const canRedo = currentIndexRef.current < history.current.length - 1;

  const clearHistory = useCallback(() => {
    history.current = [];
    currentIndexRef.current = -1;
    forceUpdate(prev => prev + 1);
  }, []);

  return {
    saveCurrentState,
    requestStateSave,
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    clearHistory,
    historySize: history.current.length,
    currentIndex: currentIndexRef.current,
  };
}