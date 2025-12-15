import { describe, it, expect } from "vitest";
import { formatSanskritLines, isSpeakerIntro } from "./sanskritFormatter";

describe("sanskritFormatter", () => {
  describe("formatSanskritLines", () => {
    it("should break line after speaker intro (वाच pattern) with space", () => {
      const text = "श्रीभगवानुवाच कर्मण्येवाधिकारस्ते";
      const lines = formatSanskritLines(text, { mode: "detail" });

      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toContain("वाच");
      expect(lines[0]).not.toContain("कर्मण्ये");
    });

    it("should break line after speaker intro (वाच pattern) without space", () => {
      // Real data pattern: no space between वाच and verse
      const text = "श्रीभगवानुवाचऊर्ध्वमूलमधःशाखम्";
      const lines = formatSanskritLines(text, { mode: "detail" });

      expect(lines.length).toBeGreaterThan(1);
      expect(lines[0]).toContain("वाच");
      expect(lines[0]).not.toContain("ऊर्ध्व");
    });

    it("should handle various speaker intros (अर्जुन उवाच, संजय उवाच)", () => {
      const arjunaText = "अर्जुन उवाच पश्यैतान्";
      const sanjayaText = "संजय उवाच एवमुक्त्वा";

      const arjunaLines = formatSanskritLines(arjunaText, { mode: "detail" });
      const sanjayaLines = formatSanskritLines(sanjayaText, { mode: "detail" });

      expect(arjunaLines[0]).toContain("उवाच");
      expect(arjunaLines[0]).not.toContain("पश्य");

      expect(sanjayaLines[0]).toContain("उवाच");
      expect(sanjayaLines[0]).not.toContain("एवम");
    });

    it("should skip speaker intro in compact mode when includeSpeakerIntro is false", () => {
      const text = "श्रीभगवानुवाच कर्मण्येवाधिकारस्ते";
      const lines = formatSanskritLines(text, {
        mode: "compact",
        includeSpeakerIntro: false,
      });

      // Should not have speaker intro line
      expect(lines.every((line) => !line.includes("वाच"))).toBe(true);
    });

    it("should remove verse number at end", () => {
      const text = "कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।।2.47।।";
      const lines = formatSanskritLines(text, { mode: "detail" });

      expect(lines.join("")).not.toContain("2.47");
    });
  });

  describe("isSpeakerIntro", () => {
    it("should return true for lines containing वाच", () => {
      expect(isSpeakerIntro("श्रीभगवानुवाच")).toBe(true);
      expect(isSpeakerIntro("अर्जुन उवाच")).toBe(true);
      expect(isSpeakerIntro("संजय उवाच")).toBe(true);
    });

    it("should return false for regular verse lines", () => {
      expect(isSpeakerIntro("कर्मण्येवाधिकारस्ते")).toBe(false);
      expect(isSpeakerIntro("धर्मक्षेत्रे कुरुक्षेत्रे")).toBe(false);
    });
  });
});
