import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prefetchVerse, clearPrefetchCache, isPrefetched } from "./versePrefetch";

describe("versePrefetch", () => {
  // Track created link elements for cleanup
  let createdLinks: HTMLLinkElement[] = [];
  const originalAppendChild = document.head.appendChild.bind(document.head);

  beforeEach(() => {
    // Clear the prefetch cache before each test
    clearPrefetchCache();
    createdLinks = [];

    // Spy on appendChild to track created links
    vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLLinkElement) {
        createdLinks.push(node);
      }
      return originalAppendChild(node);
    });
  });

  afterEach(() => {
    // Clean up any created links
    createdLinks.forEach((link) => link.remove());
    vi.restoreAllMocks();
  });

  describe("prefetchVerse", () => {
    it("creates prefetch links for verse data and translations", () => {
      prefetchVerse("BG_2_47");

      expect(createdLinks).toHaveLength(2);
      expect(createdLinks[0].rel).toBe("prefetch");
      expect(createdLinks[0].as).toBe("fetch");
      expect(createdLinks[0].href).toContain("/api/v1/verses/BG_2_47");
      expect(createdLinks[1].href).toContain("/api/v1/verses/BG_2_47/translations");
    });

    it("sets crossOrigin to anonymous", () => {
      prefetchVerse("BG_1_1");

      expect(createdLinks[0].crossOrigin).toBe("anonymous");
      expect(createdLinks[1].crossOrigin).toBe("anonymous");
    });

    it("skips duplicate prefetch requests", () => {
      prefetchVerse("BG_2_47");
      prefetchVerse("BG_2_47");
      prefetchVerse("BG_2_47");

      // Should only create 2 links (verse + translations), not 6
      expect(createdLinks).toHaveLength(2);
    });

    it("prefetches different verses independently", () => {
      prefetchVerse("BG_2_47");
      prefetchVerse("BG_2_48");

      // 2 links per verse = 4 total
      expect(createdLinks).toHaveLength(4);
    });

    it("marks verse as prefetched", () => {
      expect(isPrefetched("BG_2_47")).toBe(false);

      prefetchVerse("BG_2_47");

      expect(isPrefetched("BG_2_47")).toBe(true);
    });
  });

  describe("clearPrefetchCache", () => {
    it("clears the prefetch tracking set", () => {
      prefetchVerse("BG_2_47");
      expect(isPrefetched("BG_2_47")).toBe(true);

      clearPrefetchCache();

      expect(isPrefetched("BG_2_47")).toBe(false);
    });

    it("allows re-prefetching after cache clear", () => {
      prefetchVerse("BG_2_47");
      expect(createdLinks).toHaveLength(2);

      clearPrefetchCache();
      prefetchVerse("BG_2_47");

      // Should create 2 more links after cache clear
      expect(createdLinks).toHaveLength(4);
    });
  });

  describe("isPrefetched", () => {
    it("returns false for unprefetched verses", () => {
      expect(isPrefetched("BG_2_47")).toBe(false);
      expect(isPrefetched("BG_1_1")).toBe(false);
    });

    it("returns true for prefetched verses", () => {
      prefetchVerse("BG_2_47");

      expect(isPrefetched("BG_2_47")).toBe(true);
      expect(isPrefetched("BG_1_1")).toBe(false);
    });
  });

  describe("link cleanup", () => {
    it("removes link on successful load", () => {
      prefetchVerse("BG_2_47");

      const link = createdLinks[0];
      expect(document.head.contains(link)).toBe(true);

      // Simulate load event
      link.onload?.(new Event("load"));

      expect(document.head.contains(link)).toBe(false);
    });

    it("removes link on error", () => {
      prefetchVerse("BG_2_47");

      const link = createdLinks[0];
      expect(document.head.contains(link)).toBe(true);

      // Simulate error event
      link.onerror?.(new Event("error"));

      expect(document.head.contains(link)).toBe(false);
    });
  });
});
