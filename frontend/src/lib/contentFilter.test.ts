/**
 * Tests for client-side content validation.
 */

import { describe, it, expect } from "vitest";
import { validateContent, getViolationType } from "./contentFilter";

describe("contentFilter", () => {
  describe("validateContent", () => {
    // === SHOULD PASS: Legitimate ethical dilemmas ===

    it("allows legitimate ethical dilemma", () => {
      const result = validateContent(
        "My boss asked me to falsify a report. Should I do it?"
      );
      expect(result.valid).toBe(true);
    });

    it("allows complex workplace scenario", () => {
      const result = validateContent(
        "I discovered my colleague is taking credit for my work. How should I handle this situation?"
      );
      expect(result.valid).toBe(true);
    });

    it("allows contextual harsh language", () => {
      const result = validateContent(
        "My boss said my work was worthless. Should I report this to HR?"
      );
      expect(result.valid).toBe(true);
    });

    it("allows mild profanity in context", () => {
      const result = validateContent(
        "I feel like crap about this decision. It's a damn mess."
      );
      expect(result.valid).toBe(true);
    });

    it("allows short valid input", () => {
      const result = validateContent("help me decide");
      expect(result.valid).toBe(true);
    });

    it("allows very short input (might still be typing)", () => {
      const result = validateContent("help");
      expect(result.valid).toBe(true);
    });

    // === SHOULD BLOCK: Direct abuse ===

    it("blocks direct insult", () => {
      const result = validateContent("you are an idiot");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("rephrase");
    });

    it("blocks profanity directed at reader", () => {
      const result = validateContent("fuck you");
      expect(result.valid).toBe(false);
    });

    it("blocks 'go to hell'", () => {
      const result = validateContent("go to hell");
      expect(result.valid).toBe(false);
    });

    it("blocks abuse acronyms in context", () => {
      // Note: "stfu" alone is <5 chars and skipped (might be typing)
      // But in a longer phrase it should be caught
      const result = validateContent("just stfu already");
      expect(result.valid).toBe(false);
    });

    it("blocks 'you suck'", () => {
      const result = validateContent("you suck");
      expect(result.valid).toBe(false);
    });

    // === SHOULD BLOCK: Gibberish ===

    it("blocks random characters", () => {
      const result = validateContent(
        "dfsdfdsfsdfsdfsdfd dsfsdfd sdfsdf afsfsd"
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("clear description");
    });

    it("blocks repeated short words", () => {
      const result = validateContent("asas as as s as sa as s a s as asaas");
      expect(result.valid).toBe(false);
    });

    it("blocks repeated same word", () => {
      const result = validateContent("the the the the the the the");
      expect(result.valid).toBe(false);
    });

    it("allows short numeric input", () => {
      // Short inputs without letters are allowed (might be references)
      const result = validateContent("12345");
      expect(result.valid).toBe(true);
    });
  });

  describe("getViolationType", () => {
    it("returns 'valid' for legitimate content", () => {
      expect(
        getViolationType("Should I report my colleague for unethical behavior?")
      ).toBe("valid");
    });

    it("returns 'gibberish' for random characters", () => {
      expect(getViolationType("asdfasdf asdfasdf asdfasdf")).toBe("gibberish");
    });

    it("returns 'abuse' for direct insults", () => {
      expect(getViolationType("you are an idiot")).toBe("abuse");
    });
  });
});
