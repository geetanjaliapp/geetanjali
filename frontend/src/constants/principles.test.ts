/**
 * Principle Taxonomy - Smoke Tests
 *
 * These tests verify the taxonomy exports correctly and helper functions work.
 * We don't test every principle ID - TypeScript ensures the structure is correct.
 */
import { describe, it, expect } from "vitest";
import {
  PRINCIPLE_TAXONOMY,
  getPrincipleLabel,
  getPrincipleShortLabel,
  getPrincipleDescription,
} from "./principles";

describe("PRINCIPLE_TAXONOMY", () => {
  it("should export valid principle taxonomy with required fields", () => {
    // Verify taxonomy is non-empty
    const principles = Object.values(PRINCIPLE_TAXONOMY);
    expect(principles.length).toBeGreaterThan(0);

    // Verify structure of a sample principle
    const firstPrinciple = principles[0];
    expect(firstPrinciple).toHaveProperty("label");
    expect(firstPrinciple).toHaveProperty("shortLabel");
    expect(firstPrinciple).toHaveProperty("description");
    expect(typeof firstPrinciple.label).toBe("string");
    expect(firstPrinciple.label.length).toBeGreaterThan(0);
  });
});

describe("Principle helper functions", () => {
  it("should return labels for known principles and handle unknowns gracefully", () => {
    // Known principle
    expect(getPrincipleLabel("dharma")).toBe("Righteous Duty");
    expect(getPrincipleShortLabel("dharma")).toBe("Duty");
    expect(getPrincipleDescription("dharma")).toContain("responsibilities");

    // Legacy mapping works
    expect(getPrincipleLabel("duty_focus")).toBe("Righteous Duty");

    // Unknown principle returns ID or empty
    expect(getPrincipleLabel("unknown")).toBe("unknown");
    expect(getPrincipleShortLabel("unknown")).toBe("unknown");
    expect(getPrincipleDescription("unknown")).toBe("");
  });
});
