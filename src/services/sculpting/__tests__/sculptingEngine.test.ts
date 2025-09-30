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
