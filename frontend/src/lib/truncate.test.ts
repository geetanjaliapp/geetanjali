/**
 * Truncate Utility Tests
 */

import { describe, it, expect } from "vitest";
import { truncateText, truncateForSEO, truncateForDisplay } from "./truncate";

describe("truncateText", () => {
  it("returns empty string for empty input", () => {
    expect(truncateText("", 10)).toBe("");
  });

  it("returns original text if shorter than maxLength", () => {
    expect(truncateText("Hello", 10)).toBe("Hello");
  });

  it("returns original text if exactly maxLength", () => {
    expect(truncateText("Hello", 5)).toBe("Hello");
  });

  it("truncates and adds ellipsis if longer than maxLength", () => {
    expect(truncateText("Hello World", 8)).toBe("Hello...");
  });

  it("uses custom ellipsis", () => {
    expect(truncateText("Hello World", 8, "…")).toBe("Hello W…");
  });

  it("trims trailing whitespace before ellipsis", () => {
    expect(truncateText("Hello    World", 10)).toBe("Hello...");
  });

  it("handles maxLength smaller than ellipsis", () => {
    expect(truncateText("Hello", 2)).toBe("..");
  });

  it("handles maxLength equal to ellipsis length", () => {
    expect(truncateText("Hello", 3)).toBe("...");
  });

  it("handles empty ellipsis", () => {
    expect(truncateText("Hello World", 5, "")).toBe("Hello");
  });

  it("handles null/undefined gracefully", () => {
    // TypeScript would catch this, but runtime safety
    expect(truncateText(null as unknown as string, 10)).toBe(null);
    expect(truncateText(undefined as unknown as string, 10)).toBe(undefined);
  });
});

describe("truncateForSEO", () => {
  it("uses 150 character limit", () => {
    const longText = "A".repeat(200);
    const result = truncateForSEO(longText);
    expect(result.length).toBe(150);
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns short text unchanged", () => {
    expect(truncateForSEO("Short text")).toBe("Short text");
  });
});

describe("truncateForDisplay", () => {
  it("uses 80 character limit", () => {
    const longText = "A".repeat(100);
    const result = truncateForDisplay(longText);
    expect(result.length).toBe(80);
    expect(result.endsWith("...")).toBe(true);
  });

  it("returns short text unchanged", () => {
    expect(truncateForDisplay("Short text")).toBe("Short text");
  });
});
