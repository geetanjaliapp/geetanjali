import { describe, it, expect } from "vitest";
import {
  extractVerseRefs,
  formatVerseRef,
  formatVerseDisplay,
  formatChapterVerse,
  normalizeVerseRefs,
  parseCanonicalId,
  hasVerseRefs,
} from "./verseLinker";

describe("verseLinker", () => {
  describe("formatVerseRef (prose format)", () => {
    it("converts canonical to prose format", () => {
      expect(formatVerseRef("BG_2_47")).toBe("BG 2.47");
      expect(formatVerseRef("BG_18_66")).toBe("BG 18.66");
      expect(formatVerseRef("BG_1_1")).toBe("BG 1.1");
    });

    it("returns input if not valid canonical format", () => {
      expect(formatVerseRef("invalid")).toBe("invalid");
      expect(formatVerseRef("2.47")).toBe("2.47");
    });
  });

  describe("formatVerseDisplay (ornamental format)", () => {
    it("converts canonical to display format without BG prefix", () => {
      expect(formatVerseDisplay("BG_2_47")).toBe("2.47");
      expect(formatVerseDisplay("BG_18_66")).toBe("18.66");
      expect(formatVerseDisplay("BG_1_1")).toBe("1.1");
    });

    it("returns input if not valid canonical format", () => {
      expect(formatVerseDisplay("invalid")).toBe("invalid");
    });
  });

  describe("formatChapterVerse", () => {
    it("formats chapter and verse numbers", () => {
      expect(formatChapterVerse(2, 47)).toBe("2.47");
      expect(formatChapterVerse(18, 66)).toBe("18.66");
      expect(formatChapterVerse(1, 1)).toBe("1.1");
    });
  });

  describe("normalizeVerseRefs", () => {
    it("normalizes BG X.Y to canonical format", () => {
      expect(normalizeVerseRefs("See BG 2.47 for guidance")).toBe(
        "See BG_2_47 for guidance"
      );
    });

    it("normalizes BG X Y (space-separated) to canonical", () => {
      expect(normalizeVerseRefs("Reference BG 18 66")).toBe(
        "Reference BG_18_66"
      );
    });

    it("normalizes parenthesized refs", () => {
      expect(normalizeVerseRefs("(BG 2.47)")).toBe("(BG_2_47)");
    });

    it("normalizes multiple refs in text", () => {
      expect(normalizeVerseRefs("See BG 2.47 and BG 3.35")).toBe(
        "See BG_2_47 and BG_3_35"
      );
    });

    it("leaves canonical format unchanged", () => {
      expect(normalizeVerseRefs("See BG_2_47")).toBe("See BG_2_47");
    });
  });

  describe("extractVerseRefs", () => {
    it("extracts canonical format refs", () => {
      const refs = extractVerseRefs("See BG_2_47 for guidance");
      expect(refs).toHaveLength(1);
      expect(refs[0].canonicalId).toBe("BG_2_47");
      expect(refs[0].chapter).toBe(2);
      expect(refs[0].verse).toBe(47);
    });

    it("extracts prose format refs", () => {
      const refs = extractVerseRefs("See BG 2.47");
      expect(refs).toHaveLength(1);
      expect(refs[0].canonicalId).toBe("BG_2_47");
    });

    it("extracts space-separated format (LLM output)", () => {
      const refs = extractVerseRefs("Reference BG 18 66");
      expect(refs).toHaveLength(1);
      expect(refs[0].canonicalId).toBe("BG_18_66");
    });

    it("extracts parenthesized refs", () => {
      const refs = extractVerseRefs("Practice restraint (BG 6.26)");
      expect(refs).toHaveLength(1);
      expect(refs[0].hasParens).toBe(true);
      expect(refs[0].canonicalId).toBe("BG_6_26");
    });

    it("extracts multiple refs", () => {
      const refs = extractVerseRefs("BG_2_47 and BG 3.35 are important");
      expect(refs).toHaveLength(2);
      expect(refs[0].canonicalId).toBe("BG_2_47");
      expect(refs[1].canonicalId).toBe("BG_3_35");
    });
  });

  describe("parseCanonicalId", () => {
    it("parses valid canonical IDs", () => {
      expect(parseCanonicalId("BG_2_47")).toEqual({ chapter: 2, verse: 47 });
      expect(parseCanonicalId("BG_18_66")).toEqual({ chapter: 18, verse: 66 });
    });

    it("returns null for invalid format", () => {
      expect(parseCanonicalId("invalid")).toBeNull();
      expect(parseCanonicalId("2.47")).toBeNull();
    });
  });

  describe("hasVerseRefs", () => {
    it("returns true if text contains verse refs", () => {
      expect(hasVerseRefs("See BG_2_47")).toBe(true);
      expect(hasVerseRefs("See BG 2.47")).toBe(true);
    });

    it("returns false if no verse refs", () => {
      expect(hasVerseRefs("No verse here")).toBe(false);
    });
  });
});
