import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  applySculptingStroke,
  calculateSymmetryPoints,
  type SculptingStrokeParams,
} from "../sculptingEngine";
import {
  createTestSphere,
  verifyGeometrySymmetry,
  compareVertexDisplacements,
  verifySymmetricDisplacements,
  getVertexCount,
  cloneGeometry,
} from "./testUtils";

// Helper to apply sculpting stroke with cloneGeometry and ensureSymmetry enabled for tests
function testSculpt(params: SculptingStrokeParams) {
  return applySculptingStroke({
    ...params,
    cloneGeometry: true,
    ensureSymmetry: true,
  });
}

describe("Sculpting Engine", () => {
  describe("calculateSymmetryPoints", () => {
    it("returns only the original point when no symmetry is enabled", () => {
      const point = new THREE.Vector3(1, 2, 3);
      const points = calculateSymmetryPoints(point, {
        x: false,
        y: false,
        z: false,
      });

      expect(points).toHaveLength(1);
      expect(points[0].equals(point)).toBe(true);
    });

    it("returns 2 points for single axis symmetry", () => {
      const point = new THREE.Vector3(1, 2, 3);
      const points = calculateSymmetryPoints(point, {
        x: true,
        y: false,
        z: false,
      });

      expect(points).toHaveLength(2);
      expect(points[0].equals(new THREE.Vector3(1, 2, 3))).toBe(true);
      expect(points[1].equals(new THREE.Vector3(-1, 2, 3))).toBe(true);
    });

    it("returns 4 points for two-axis symmetry", () => {
      const point = new THREE.Vector3(1, 2, 3);
      const points = calculateSymmetryPoints(point, {
        x: true,
        y: true,
        z: false,
      });

      expect(points).toHaveLength(4);
    });

    it("returns 8 points for three-axis symmetry", () => {
      const point = new THREE.Vector3(1, 2, 3);
      const points = calculateSymmetryPoints(point, {
        x: true,
        y: true,
        z: true,
      });

      expect(points).toHaveLength(8);
    });
  });

  describe("Basic Sculpting - No Symmetry", () => {
    it("modifies geometry with add tool", () => {
      const geometry = createTestSphere(1, 8, 6);
      const beforeCount = getVertexCount(geometry);

      const result = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: false, // Disable subdivision for basic test
      });

      expect(result.modified).toBe(true);
      expect(getVertexCount(result.geometry)).toBe(beforeCount);

      // Check that some vertices moved
      const displacements = compareVertexDisplacements(
        geometry,
        result.geometry
      );
      expect(displacements.size).toBeGreaterThan(0);
    });

    it("modifies geometry with subtract tool", () => {
      const geometry = createTestSphere(1, 8, 6);

      const result = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "subtract",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: false,
      });

      expect(result.modified).toBe(true);

      // Verify vertices moved inward (negative displacement along normal)
      const displacements = compareVertexDisplacements(
        geometry,
        result.geometry
      );
      expect(displacements.size).toBeGreaterThan(0);
    });
  });

  describe("Symmetry - Add/Subtract Tool", () => {
    it("maintains X-axis symmetry with add tool", () => {
      const geometry = createTestSphere(1, 16, 12);
      const before = cloneGeometry(geometry);

      const result = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(0.8, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: true, y: false, z: false },
        shouldSubdivide: false,
      });

      expect(result.modified).toBe(true);

      // Verify geometry is still symmetric
      const symmetryCheck = verifyGeometrySymmetry(
        result.geometry,
        { x: true },
        0.001
      );
      expect(symmetryCheck.isSymmetric).toBe(true);

      // Verify displacements are symmetric
      const displacements = compareVertexDisplacements(before, result.geometry);
      const dispCheck = verifySymmetricDisplacements(
        result.geometry,
        displacements,
        { x: true },
        0.02
      );

      if (!dispCheck.isSymmetric) {
        console.log("Symmetry errors:", dispCheck.errors);
      }

      expect(dispCheck.isSymmetric).toBe(true);
    });

    it("maintains Y-axis symmetry with subtract tool", () => {
      const geometry = createTestSphere(1, 16, 12);
      const before = cloneGeometry(geometry);

      const result = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(0, 0.8, 0),
        tool: "subtract",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: true, z: false },
        shouldSubdivide: false,
      });

      expect(result.modified).toBe(true);

      // Verify displacements are symmetric
      const displacements = compareVertexDisplacements(before, result.geometry);
      const dispCheck = verifySymmetricDisplacements(
        result.geometry,
        displacements,
        { y: true },
        0.02
      );

      expect(dispCheck.isSymmetric).toBe(true);
    });

    it("maintains XYZ symmetry with add tool", () => {
      const geometry = createTestSphere(1, 16, 12);
      const before = cloneGeometry(geometry);

      const result = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(0.6, 0.6, 0.6),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: true, y: true, z: true },
        shouldSubdivide: false,
      });

      expect(result.modified).toBe(true);

      const displacements = compareVertexDisplacements(before, result.geometry);
      const dispCheck = verifySymmetricDisplacements(
        result.geometry,
        displacements,
        { x: true, y: true, z: true },
        0.02
      );

      expect(dispCheck.isSymmetric).toBe(true);
    });
  });

  describe("Subdivision Integration", () => {
    it("subdivides geometry when needed", () => {
      const geometry = createTestSphere(1, 8, 6);
      const beforeCount = getVertexCount(geometry);

      const result = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
      });

      const afterCount = getVertexCount(result.geometry);
      expect(afterCount).toBeGreaterThan(beforeCount);
    });

    it("subdivides geometry by default when shouldSubdivide is not specified", () => {
      const geometry = createTestSphere(1, 8, 6);
      const beforeCount = getVertexCount(geometry);

      // Don't pass shouldSubdivide - should default to subdivision enabled
      const result = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
      });

      const afterCount = getVertexCount(result.geometry);
      expect(afterCount).toBeGreaterThan(beforeCount);
    });

    it("increases mesh density proportionally to brush size", () => {
      const geometry = createTestSphere(1, 8, 6);
      const beforeCount = getVertexCount(geometry);

      // Large brush should create more subdivision
      const result = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 1.0, // Larger brush
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
      });

      const afterCount = getVertexCount(result.geometry);
      const increase = afterCount - beforeCount;

      // Should add significant vertices for large brush
      expect(increase).toBeGreaterThan(50);
    });

    it("adapts mesh density over multiple strokes in same area", () => {
      let geometry = createTestSphere(1, 8, 6);
      const beforeCount = getVertexCount(geometry);

      // First stroke - should subdivide
      const result1 = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(0.9, 0, 0),
        tool: "add",
        brushSize: 0.4,
        brushStrength: 0.3,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
      });

      const countAfterFirst = getVertexCount(result1.geometry);
      expect(countAfterFirst).toBeGreaterThan(beforeCount);

      // Second stroke in overlapping area - may subdivide more if needed
      geometry = result1.geometry;
      const result2 = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(0.95, 0.1, 0),
        tool: "add",
        brushSize: 0.4,
        brushStrength: 0.3,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
      });

      const countAfterSecond = getVertexCount(result2.geometry);

      // Count should be at least as much as first stroke (possibly more if edges still too long)
      expect(countAfterSecond).toBeGreaterThanOrEqual(countAfterFirst);
    });

    it("subdivides in UI mode (without ensureSymmetry)", () => {
      const geometry = createTestSphere(1, 8, 6);
      const beforeCount = getVertexCount(geometry);

      // Simulate UI call without ensureSymmetry flag
      const result = applySculptingStroke({
        geometry,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
        cloneGeometry: true, // Clone for test
        ensureSymmetry: false, // UI mode - no expensive symmetry check
      });

      const afterCount = getVertexCount(result.geometry);
      expect(afterCount).toBeGreaterThan(beforeCount);
      expect(result.modified).toBe(true);
    });

    it("maintains symmetry after subdivision with X symmetry", () => {
      const geometry = createTestSphere(1, 8, 6);

      const result = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(0.8, 0, 0),
        tool: "add",
        brushSize: 0.6,
        brushStrength: 0.5,
        symmetryAxes: { x: true, y: false, z: false },
        shouldSubdivide: true,
      });

      // Verify geometry topology is symmetric
      const symmetryCheck = verifyGeometrySymmetry(
        result.geometry,
        { x: true },
        0.001
      );
      if (!symmetryCheck.isSymmetric) {
        console.log(
          "Geometry symmetry errors:",
          symmetryCheck.errors.slice(0, 5)
        );
      }
      expect(symmetryCheck.isSymmetric).toBe(true);

      // Note: We can't easily compare displacements when subdivision adds vertices
      // The important check is that the final geometry is symmetric
    });

    it("maintains symmetry with large brush near symmetry plane", () => {
      const geometry = createTestSphere(1, 12, 10);

      // Click very close to X=0 plane with large brush
      const result = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(0.2, 0.5, 0),
        tool: "add",
        brushSize: 1.5, // Large brush that crosses X=0
        brushStrength: 0.5,
        symmetryAxes: { x: true, y: false, z: false },
        shouldSubdivide: true,
      });

      // Verify geometry topology is symmetric
      // Use larger tolerance for large brush test due to accumulated floating point errors
      const symmetryCheck = verifyGeometrySymmetry(
        result.geometry,
        { x: true },
        0.01
      );
      if (!symmetryCheck.isSymmetric) {
        console.log(
          "Large brush symmetry errors:",
          symmetryCheck.errors.slice(0, 10)
        );
      }

      expect(symmetryCheck.isSymmetric).toBe(true);

      // Note: We can't compare displacements when subdivision adds vertices
    });
  });

  describe("Multiple Strokes with Progressive Subdivision", () => {
    it("maintains symmetry across multiple strokes", () => {
      let geometry = createTestSphere(1, 8, 6);

      // First stroke
      const result1 = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(0.8, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.3,
        symmetryAxes: { x: true, y: false, z: false },
        shouldSubdivide: true,
      });

      geometry = result1.geometry;

      // Second stroke on already subdivided area
      const result2 = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(0.85, 0.1, 0),
        tool: "add",
        brushSize: 0.4,
        brushStrength: 0.3,
        symmetryAxes: { x: true, y: false, z: false },
        shouldSubdivide: true,
      });

      // Verify final geometry is symmetric
      const symmetryCheck = verifyGeometrySymmetry(
        result2.geometry,
        { x: true },
        0.001
      );
      if (!symmetryCheck.isSymmetric) {
        console.log(
          "Multiple stroke errors:",
          symmetryCheck.errors.slice(0, 5)
        );
      }

      expect(symmetryCheck.isSymmetric).toBe(true);

      // Note: We can't compare displacements when subdivision adds vertices
    });

    it("maintains symmetry with three consecutive strokes", () => {
      let geometry = createTestSphere(1, 10, 8);

      const clickPoints = [
        new THREE.Vector3(0.7, 0.3, 0),
        new THREE.Vector3(0.75, 0.25, 0.1),
        new THREE.Vector3(0.8, 0.2, -0.1),
      ];

      for (const clickPoint of clickPoints) {
        const result = testSculpt({
          geometry,
          clickPoint,
          tool: "add",
          brushSize: 0.5,
          brushStrength: 0.3,
          symmetryAxes: { x: true, y: false, z: false },
          shouldSubdivide: true,
        });

        geometry = result.geometry;

        // Verify geometry is symmetric after each stroke
        const symmetryCheck = verifyGeometrySymmetry(
          result.geometry,
          { x: true },
          0.001
        );
        if (!symmetryCheck.isSymmetric) {
          console.log(
            `Stroke at ${clickPoint.toArray()} symmetry errors:`,
            symmetryCheck.errors.slice(0, 3)
          );
        }

        expect(symmetryCheck.isSymmetric).toBe(true);
      }

      // Note: We can't compare displacements when subdivision adds vertices
    });
  });

  describe("Mouse Interaction Simulation", () => {
    it("preserves mesh refinement after mouse release (no revert)", () => {
      // Start with a fresh sphere
      const initialGeometry = createTestSphere(1, 8, 6);
      const beforeCount = getVertexCount(initialGeometry);

      // Simulate mouse down + first sculpt stroke WITH subdivision
      const strokeResult = applySculptingStroke({
        geometry: initialGeometry,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
        cloneGeometry: false, // UI mode - no clone
        ensureSymmetry: false,
      });

      const afterStrokeCount = getVertexCount(strokeResult.geometry);

      // Verify subdivision happened (starts at ~54 after merging, should add more)
      expect(strokeResult.modified).toBe(true);
      expect(afterStrokeCount).toBeGreaterThan(beforeCount);
      expect(strokeResult.geometry).not.toBe(initialGeometry); // New geometry created

      // Store the subdivided geometry as if mesh.geometry was updated
      const subdividedGeometry = strokeResult.geometry;

      // Simulate mouse release - no action taken, just checking state
      // The geometry should remain subdivided, not revert to initial

      // Verify the subdivided geometry is still valid and has subdivision
      expect(getVertexCount(subdividedGeometry)).toBe(afterStrokeCount);
      expect(getVertexCount(subdividedGeometry)).toBeGreaterThan(beforeCount);

      // Simulate starting a NEW stroke on the subdivided geometry
      // This should NOT revert to original geometry
      const secondStroke = applySculptingStroke({
        geometry: subdividedGeometry, // Use the result from first stroke
        clickPoint: new THREE.Vector3(0.95, 0.05, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: false, // Throttled, no new subdivision
        cloneGeometry: false,
        ensureSymmetry: false,
      });

      // Should still have the subdivided vertex count
      expect(getVertexCount(secondStroke.geometry)).toBe(afterStrokeCount);
      expect(secondStroke.modified).toBe(true);
    });

    it("does not lose subdivision when passing geometry between strokes", () => {
      const geo1 = createTestSphere(1, 8, 6);
      const beforeCount = getVertexCount(geo1);

      // First stroke - creates subdivision
      const result1 = applySculptingStroke({
        geometry: geo1,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.3,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
        cloneGeometry: false,
      });

      const count2 = getVertexCount(result1.geometry);
      expect(count2).toBeGreaterThan(beforeCount);

      // Critical: Store the geometry reference like mesh.geometry would
      const storedGeometry = result1.geometry;

      // Second stroke using the stored reference (simulating continuous drawing)
      const result2 = applySculptingStroke({
        geometry: storedGeometry, // Use stored reference
        clickPoint: new THREE.Vector3(0.98, 0.02, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.3,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: false,
        cloneGeometry: false,
      });

      // Should maintain subdivision from first stroke
      expect(getVertexCount(result2.geometry)).toBe(count2);

      // Third stroke
      const result3 = applySculptingStroke({
        geometry: result2.geometry,
        clickPoint: new THREE.Vector3(0.96, 0.04, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.3,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: false,
        cloneGeometry: false,
      });

      // Should STILL maintain subdivision
      expect(getVertexCount(result3.geometry)).toBe(count2);
    });

    it("simulates exact UI flow: subdivision -> in-place modification -> no revert", () => {
      // This simulates the exact flow in useSculpting.ts

      // Initial state: mesh has this geometry
      let meshGeometry = createTestSphere(1, 8, 6);
      const initialVertices = getVertexCount(meshGeometry);

      console.log(`Initial vertices: ${initialVertices}`);

      // User presses mouse - first stroke with subdivision
      const stroke1 = applySculptingStroke({
        geometry: meshGeometry, // Pass mesh.geometry
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
        cloneGeometry: false, // UI mode
      });

      console.log(
        `After stroke 1: ${getVertexCount(
          stroke1.geometry
        )} vertices, modified=${stroke1.modified}`
      );

      // UI updates: mesh.geometry = result.geometry
      if (stroke1.modified) {
        meshGeometry = stroke1.geometry;
      }

      const afterSubdivisionVertices = getVertexCount(meshGeometry);
      expect(afterSubdivisionVertices).toBeGreaterThan(initialVertices);

      // User continues dragging - second stroke (throttled, no subdivision)
      const stroke2 = applySculptingStroke({
        geometry: meshGeometry, // Use updated mesh.geometry
        clickPoint: new THREE.Vector3(0.98, 0.02, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: false, // Throttled
        cloneGeometry: false,
      });

      console.log(
        `After stroke 2: ${getVertexCount(
          stroke2.geometry
        )} vertices, modified=${stroke2.modified}`
      );

      // UI updates
      if (stroke2.modified) {
        meshGeometry = stroke2.geometry;
      }

      // Vertex count should remain the same (no new subdivision, just deformation)
      expect(getVertexCount(meshGeometry)).toBe(afterSubdivisionVertices);

      // User releases mouse - no action, just checking state
      console.log(
        `After mouse release: ${getVertexCount(meshGeometry)} vertices`
      );

      // CRITICAL CHECK: Geometry should STILL be subdivided
      expect(getVertexCount(meshGeometry)).toBe(afterSubdivisionVertices);
      expect(getVertexCount(meshGeometry)).toBeGreaterThan(initialVertices);

      // User presses mouse again on same area - new stroke
      const stroke3 = applySculptingStroke({
        geometry: meshGeometry,
        clickPoint: new THREE.Vector3(0.96, 0.04, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true, // Can subdivide again
        cloneGeometry: false,
      });

      console.log(
        `After stroke 3: ${getVertexCount(stroke3.geometry)} vertices`
      );

      // Should have at least the previous subdivision
      expect(getVertexCount(stroke3.geometry)).toBeGreaterThanOrEqual(
        afterSubdivisionVertices
      );
    });

    it("reproduces React state sync bug: in-place modification not updating state", () => {
      // This test simulates the exact bug where React state becomes stale

      // Simulate React component state
      let reactStateGeometry = createTestSphere(1, 8, 6);
      const initialVertices = getVertexCount(reactStateGeometry);

      // Simulate mesh.current.geometry ref (starts same as React state)
      let meshRefGeometry = reactStateGeometry;

      console.log(`\n=== Initial State ===`);
      console.log(
        `React state vertices: ${getVertexCount(reactStateGeometry)}`
      );
      console.log(`Mesh ref vertices: ${getVertexCount(meshRefGeometry)}`);
      console.log(`Same reference: ${reactStateGeometry === meshRefGeometry}`);

      // STROKE 1: Subdivision creates new geometry
      console.log(`\n=== Stroke 1: With Subdivision ===`);
      const result1 = applySculptingStroke({
        geometry: meshRefGeometry,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
        cloneGeometry: false,
      });

      console.log(`Result modified: ${result1.modified}`);
      console.log(`Result vertices: ${getVertexCount(result1.geometry)}`);
      console.log(
        `New geometry created: ${result1.geometry !== meshRefGeometry}`
      );

      // Simulate UI behavior: update mesh ref
      meshRefGeometry = result1.geometry;

      // Simulate UI behavior: check if we should update React state
      // BUG: Only updates state if geometry reference changed
      const shouldUpdateState = result1.geometry !== reactStateGeometry;
      console.log(`Should update React state: ${shouldUpdateState}`);

      if (shouldUpdateState) {
        reactStateGeometry = result1.geometry;
        console.log(`React state UPDATED`);
      } else {
        console.log(`React state NOT updated (BUG!)`);
      }

      console.log(
        `React state vertices: ${getVertexCount(reactStateGeometry)}`
      );
      console.log(`Mesh ref vertices: ${getVertexCount(meshRefGeometry)}`);
      console.log(`States in sync: ${reactStateGeometry === meshRefGeometry}`);

      const afterSubdivision = getVertexCount(meshRefGeometry);
      expect(afterSubdivision).toBeGreaterThan(initialVertices);

      // STROKE 2: In-place modification (no subdivision)
      console.log(`\n=== Stroke 2: No Subdivision (In-Place) ===`);
      const result2 = applySculptingStroke({
        geometry: meshRefGeometry,
        clickPoint: new THREE.Vector3(0.98, 0.02, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: false, // Throttled
        cloneGeometry: false,
      });

      console.log(`Result modified: ${result2.modified}`);
      console.log(`Result vertices: ${getVertexCount(result2.geometry)}`);
      console.log(
        `Same geometry reference: ${result2.geometry === meshRefGeometry}`
      );

      meshRefGeometry = result2.geometry;

      // Simulate UI behavior: check if we should update React state
      // FIX: Always update state when modified, not just when reference changes
      const shouldUpdateState2 =
        result2.modified || result2.geometry !== reactStateGeometry;
      console.log(`Should update React state (fixed): ${shouldUpdateState2}`);

      if (shouldUpdateState2) {
        reactStateGeometry = result2.geometry;
        console.log(`React state UPDATED`);
      } else {
        console.log(`React state NOT updated (BUG!)`);
      }

      console.log(
        `React state vertices: ${getVertexCount(reactStateGeometry)}`
      );
      console.log(`Mesh ref vertices: ${getVertexCount(meshRefGeometry)}`);
      console.log(`States in sync: ${reactStateGeometry === meshRefGeometry}`);

      // SIMULATE REACT RE-RENDER
      console.log(`\n=== Simulating React Re-Render ===`);
      console.log(`React renders <mesh geometry={reactStateGeometry}>`);
      console.log(`React Three Fiber sets: mesh.geometry = reactStateGeometry`);

      // This is what React Three Fiber does on re-render
      meshRefGeometry = reactStateGeometry;

      console.log(`After re-render:`);
      console.log(`Mesh ref vertices: ${getVertexCount(meshRefGeometry)}`);

      // THE BUG: If states were not in sync, mesh has reverted!
      console.log(`\n=== Checking for Bug ===`);
      const currentVertices = getVertexCount(meshRefGeometry);
      console.log(`Current vertices: ${currentVertices}`);
      console.log(`Expected (after subdivision): ${afterSubdivision}`);
      console.log(`Has reverted: ${currentVertices < afterSubdivision}`);

      // This test SHOULD FAIL with current buggy implementation
      // It passes only if React state is kept in sync
      expect(currentVertices).toBe(afterSubdivision);
      expect(reactStateGeometry).toBe(meshRefGeometry);
    });
  });

  describe("Rapid Consecutive Strokes", () => {
    it("simulates version-based race detection with concurrent frames", () => {
      // Simulate the version-based system used in the UI
      let geometryRef = createTestSphere(1, 8, 6);
      const geometryVersionRef = { current: 0 };
      const updates: Array<{
        geometry: THREE.BufferGeometry;
        startingVersion: number;
        accepted: boolean;
      }> = [];

      // Simulate onGeometryUpdate callback from SceneObject
      const onGeometryUpdate = (
        newGeometry: THREE.BufferGeometry,
        startingVersion: number
      ): boolean => {
        console.log(
          `[onGeometryUpdate] called with startingVersion=${startingVersion}, currentVersion=${geometryVersionRef.current}`
        );

        if (geometryVersionRef.current !== startingVersion) {
          console.log(`[onGeometryUpdate] RACE DETECTED - rejecting`);
          updates.push({
            geometry: newGeometry,
            startingVersion,
            accepted: false,
          });
          return false;
        }

        geometryRef = newGeometry;
        geometryVersionRef.current++;
        console.log(
          `[onGeometryUpdate] accepted, new version=${geometryVersionRef.current}`
        );
        updates.push({
          geometry: newGeometry,
          startingVersion,
          accepted: true,
        });
        return true;
      };

      const clickPoint = new THREE.Vector3(0, 1, 0);

      console.log("\n=== Simulating Rapid Concurrent Frames ===");
      console.log("Initial vertices:", getVertexCount(geometryRef));
      console.log("Initial version:", geometryVersionRef.current);

      // Frame 1: Capture version BEFORE any work
      const frame1StartVersion = geometryVersionRef.current;
      console.log("\n[Frame 1] starts, captures version:", frame1StartVersion);

      // Frame 2: Starts immediately (before Frame 1 completes)
      const frame2StartVersion = geometryVersionRef.current;
      console.log("[Frame 2] starts, captures version:", frame2StartVersion);
      console.log("Both frames captured same version!");

      // Frame 1 completes: Should subdivide and create new geometry
      console.log("\n[Frame 1] applying stroke with subdivision...");
      const frame1Result = applySculptingStroke({
        geometry: geometryRef,
        clickPoint,
        tool: "add",
        brushSize: 0.5,
        brushStrength: 1.0,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
        cloneGeometry: false,
      });

      console.log("[Frame 1] stroke complete:", {
        modified: frame1Result.modified,
        vertices: getVertexCount(frame1Result.geometry),
        subdivided:
          getVertexCount(frame1Result.geometry) > getVertexCount(geometryRef),
      });

      // Frame 1 calls onGeometryUpdate
      const frame1Accepted = onGeometryUpdate(
        frame1Result.geometry,
        frame1StartVersion
      );
      const afterFrame1Vertices = getVertexCount(geometryRef);
      console.log(
        "[Frame 1] after update, geometryRef has",
        afterFrame1Vertices,
        "vertices"
      );

      // Frame 2 completes: No subdivision, modifies in-place
      // This should be REJECTED because version changed
      console.log("\n[Frame 2] applying stroke WITHOUT subdivision...");
      const frame2Result = applySculptingStroke({
        geometry: geometryRef, // Now points to subdivided geometry from Frame 1
        clickPoint: clickPoint.clone().add(new THREE.Vector3(0.1, 0, 0)),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 1.0,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: false,
        cloneGeometry: false,
      });

      console.log("[Frame 2] stroke complete:", {
        modified: frame2Result.modified,
        vertices: getVertexCount(frame2Result.geometry),
      });

      // Frame 2 calls onGeometryUpdate - should be REJECTED
      const frame2Accepted = onGeometryUpdate(
        frame2Result.geometry,
        frame2StartVersion
      );
      const afterFrame2Vertices = getVertexCount(geometryRef);
      console.log(
        "[Frame 2] after update attempt, geometryRef has",
        afterFrame2Vertices,
        "vertices"
      );

      console.log("\n=== Final State ===");
      console.log("Final vertices:", getVertexCount(geometryRef));
      console.log("Final version:", geometryVersionRef.current);
      console.log(
        "Updates summary:",
        updates.map((u) => ({
          vertices: getVertexCount(u.geometry),
          startingVersion: u.startingVersion,
          accepted: u.accepted,
        }))
      );

      // Assertions
      expect(frame1Accepted).toBe(true);
      expect(frame2Accepted).toBe(false); // Should be rejected due to version mismatch
      expect(afterFrame2Vertices).toBe(afterFrame1Vertices); // Should still have subdivided geometry
      expect(geometryVersionRef.current).toBe(1); // Only one update should have succeeded
      expect(updates.length).toBe(2);
      expect(updates[0].accepted).toBe(true);
      expect(updates[1].accepted).toBe(false);
    });

    it("maintains geometry consistency with rapid strokes (simulating blinking)", () => {
      let geometry = createTestSphere(1, 8, 6);
      const initialCount = getVertexCount(geometry);

      // Simulate rapid consecutive strokes at the same location
      for (let i = 0; i < 5; i++) {
        const result = testSculpt({
          geometry,
          clickPoint: new THREE.Vector3(1, 0, 0),
          tool: "add",
          brushSize: 0.5,
          brushStrength: 0.3,
          symmetryAxes: { x: false, y: false, z: false },
          shouldSubdivide: true,
        });

        expect(result.modified).toBe(true);
        const count = getVertexCount(result.geometry);

        // Vertex count should never decrease
        expect(count).toBeGreaterThanOrEqual(getVertexCount(geometry));

        // After first stroke, should have more vertices
        if (i === 0) {
          expect(count).toBeGreaterThan(initialCount);
        }

        geometry = result.geometry;
      }
    });

    it("handles alternating shouldSubdivide true/false without breaking geometry", () => {
      let geometry = createTestSphere(1, 8, 6);
      const initialCount = getVertexCount(geometry);

      // First stroke with subdivision
      const result1 = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.3,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
      });

      const countAfterSub = getVertexCount(result1.geometry);
      expect(countAfterSub).toBeGreaterThan(initialCount);
      geometry = result1.geometry;

      // Second stroke WITHOUT subdivision (simulating throttle)
      const result2 = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.3,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: false, // Throttled
      });

      expect(result2.modified).toBe(true);
      expect(getVertexCount(result2.geometry)).toBe(countAfterSub); // Same count, just deformed
      geometry = result2.geometry;

      // Third stroke WITH subdivision again
      const result3 = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.3,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
      });

      expect(result3.modified).toBe(true);
      // Should maintain or increase vertices
      expect(getVertexCount(result3.geometry)).toBeGreaterThanOrEqual(
        countAfterSub
      );
    });

    it("preserves subdivision when reusing same geometry object", () => {
      const geometry = createTestSphere(1, 8, 6);
      const initialCount = getVertexCount(geometry);

      // First stroke - with subdivision, REUSING same geometry (in-place modification)
      const result1 = applySculptingStroke({
        geometry, // No cloneGeometry
        clickPoint: new THREE.Vector3(1, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.3,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: true,
        cloneGeometry: false, // UI mode - in-place
      });

      const countAfterFirst = getVertexCount(result1.geometry);
      expect(countAfterFirst).toBeGreaterThan(initialCount);

      // Second stroke on the RESULT geometry - should preserve subdivision
      const result2 = applySculptingStroke({
        geometry: result1.geometry, // Use result from first stroke
        clickPoint: new THREE.Vector3(0.95, 0.05, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.3,
        symmetryAxes: { x: false, y: false, z: false },
        shouldSubdivide: false, // No new subdivision
        cloneGeometry: false,
      });

      // Should maintain vertices from first stroke
      expect(getVertexCount(result2.geometry)).toBe(countAfterFirst);
      expect(result2.modified).toBe(true);
    });

    it("handles geometry transitions correctly with symmetry", () => {
      let geometry = createTestSphere(1, 8, 6);

      // Stroke with subdivision + symmetry
      const result1 = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(0.8, 0, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.3,
        symmetryAxes: { x: true, y: false, z: false },
        shouldSubdivide: true,
      });

      const count1 = getVertexCount(result1.geometry);
      geometry = result1.geometry;

      // Stroke without subdivision (throttled) + symmetry
      const result2 = testSculpt({
        geometry,
        clickPoint: new THREE.Vector3(0.85, 0.1, 0),
        tool: "add",
        brushSize: 0.5,
        brushStrength: 0.3,
        symmetryAxes: { x: true, y: false, z: false },
        shouldSubdivide: false,
      });

      const count2 = getVertexCount(result2.geometry);
      expect(count2).toBe(count1); // No new subdivision
      expect(result2.modified).toBe(true);

      // Verify symmetry is still maintained
      const symmetryCheck = verifyGeometrySymmetry(
        result2.geometry,
        { x: true },
        0.001
      );
      expect(symmetryCheck.isSymmetric).toBe(true);
    });
  });

  describe("Push Tool with Symmetry", () => {
    it("maintains symmetry with push tool", () => {
      const geometry = createTestSphere(1, 16, 12);
      const before = cloneGeometry(geometry);

      const clickPoint = new THREE.Vector3(0.8, 0, 0);
      const previousPoint = new THREE.Vector3(0.75, 0.05, 0);

      const result = testSculpt({
        geometry,
        clickPoint,
        tool: "push",
        brushSize: 0.5,
        brushStrength: 0.5,
        symmetryAxes: { x: true, y: false, z: false },
        pushToolPreviousPoint: previousPoint,
        shouldSubdivide: false,
      });

      expect(result.modified).toBe(true);

      const displacements = compareVertexDisplacements(before, result.geometry);
      const dispCheck = verifySymmetricDisplacements(
        result.geometry,
        displacements,
        { x: true },
        0.02
      );

      if (!dispCheck.isSymmetric) {
        console.log("Push tool symmetry errors:", dispCheck.errors);
      }

      expect(dispCheck.isSymmetric).toBe(true);
    });
  });
});
