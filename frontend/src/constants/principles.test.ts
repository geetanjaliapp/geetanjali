import { describe, it, expect } from "vitest";
import {
  PRINCIPLE_TAXONOMY,
  getPrincipleLabel,
  getPrincipleShortLabel,
  getPrincipleDescription,
} from "./principles";

describe("PRINCIPLE_TAXONOMY", () => {
  it("should have 16 new principles", () => {
    const newPrinciples = [
      "dharma",
      "nishkama_karma",
      "svadharma",
      "seva",
      "viveka",
      "jnana",
      "sthitaprajna",
      "tyaga",
      "bhakti",
      "sharanagati",
      "shraddha",
      "dhyana",
      "samatvam",
      "discipline",
      "virtue",
      "abhyasa",
    ];

    for (const id of newPrinciples) {
      expect(PRINCIPLE_TAXONOMY[id as keyof typeof PRINCIPLE_TAXONOMY]).toBeDefined();
    }
  });

  it("should have legacy principle mappings", () => {
    const legacyPrinciples = [
      "duty_focus",
      "detachment",
      "self_control",
      "informed_choice",
      "role_fit",
      "compassion",
      "self_responsibility",
      "ethical_character",
      "consistent_duty",
    ];

    for (const id of legacyPrinciples) {
      expect(PRINCIPLE_TAXONOMY[id as keyof typeof PRINCIPLE_TAXONOMY]).toBeDefined();
    }
  });

  it("each principle should have required fields", () => {
    for (const principle of Object.values(PRINCIPLE_TAXONOMY)) {
      expect(principle.label).toBeDefined();
      expect(principle.shortLabel).toBeDefined();
      expect(principle.description).toBeDefined();
      expect(typeof principle.label).toBe("string");
      expect(typeof principle.shortLabel).toBe("string");
      expect(typeof principle.description).toBe("string");
      expect(principle.label.length).toBeGreaterThan(0);
      expect(principle.shortLabel.length).toBeGreaterThan(0);
    }
  });
});

describe("getPrincipleLabel", () => {
  it("should return label for valid principle ID", () => {
    expect(getPrincipleLabel("dharma")).toBe("Righteous Duty");
    expect(getPrincipleLabel("viveka")).toBe("Discernment");
    expect(getPrincipleLabel("bhakti")).toBe("Devotion");
  });

  it("should return label for legacy principle IDs", () => {
    expect(getPrincipleLabel("duty_focus")).toBe("Righteous Duty");
    expect(getPrincipleLabel("detachment")).toBe("Selfless Action");
    expect(getPrincipleLabel("self_control")).toBe("Self-Mastery");
  });

  it("should return ID itself for unknown principle", () => {
    expect(getPrincipleLabel("unknown_principle")).toBe("unknown_principle");
    expect(getPrincipleLabel("foo")).toBe("foo");
  });
});

describe("getPrincipleShortLabel", () => {
  it("should return short label for valid principle ID", () => {
    expect(getPrincipleShortLabel("dharma")).toBe("Duty");
    expect(getPrincipleShortLabel("viveka")).toBe("Discernment");
    expect(getPrincipleShortLabel("discipline")).toBe("Discipline");
  });

  it("should return short label for legacy principle IDs", () => {
    expect(getPrincipleShortLabel("duty_focus")).toBe("Duty");
    expect(getPrincipleShortLabel("ethical_character")).toBe("Virtue");
  });

  it("should return ID itself for unknown principle", () => {
    expect(getPrincipleShortLabel("unknown")).toBe("unknown");
  });
});

describe("getPrincipleDescription", () => {
  it("should return description for valid principle ID", () => {
    const desc = getPrincipleDescription("dharma");
    expect(desc).toContain("responsibilities");
  });

  it("should return empty string for unknown principle", () => {
    expect(getPrincipleDescription("unknown")).toBe("");
  });
});

describe("legacy to new principle mapping", () => {
  it("legacy duty_focus maps to Righteous Duty (same as dharma)", () => {
    expect(getPrincipleLabel("duty_focus")).toBe(getPrincipleLabel("dharma"));
  });

  it("legacy detachment maps to Selfless Action (same as nishkama_karma)", () => {
    expect(getPrincipleLabel("detachment")).toBe(getPrincipleLabel("nishkama_karma"));
  });

  it("legacy self_control maps to Self-Mastery (same as discipline)", () => {
    expect(getPrincipleLabel("self_control")).toBe(getPrincipleLabel("discipline"));
  });

  it("legacy ethical_character maps to Noble Qualities (same as virtue)", () => {
    expect(getPrincipleLabel("ethical_character")).toBe(getPrincipleLabel("virtue"));
  });
});
