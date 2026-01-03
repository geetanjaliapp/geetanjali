import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCrossChapterPreload, PRELOAD_THRESHOLD_VERSES } from "./useCrossChapterPreload";

// Mock audioPreload - must be defined before vi.mock
const mockPreloadAudio = vi.fn();
vi.mock("../lib/audioPreload", () => ({
  preloadAudio: (url: string) => mockPreloadAudio(url),
}));

// Mock versesApi
vi.mock("../lib/api", () => ({
  versesApi: {
    get: vi.fn().mockResolvedValue({
      id: "verse-1",
      canonical_id: "BG_3_1",
      chapter: 3,
      verse: 1,
      audio_url: "https://example.com/BG_3_1.mp3",
      created_at: "2024-01-01T00:00:00Z",
    }),
  },
}));

// Mock chapters constants
vi.mock("../constants/chapters", () => ({
  getChapterInfo: (chapter: number) => {
    const chapters: Record<number, { verses: number }> = {
      1: { verses: 47 },
      2: { verses: 72 },
      3: { verses: 43 },
    };
    return chapters[chapter] || null;
  },
  TOTAL_CHAPTERS: 18,
}));

describe("useCrossChapterPreload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should export PRELOAD_THRESHOLD_VERSES constant", () => {
    expect(PRELOAD_THRESHOLD_VERSES).toBe(2);
  });

  it("should not preload when not near chapter end", async () => {
    renderHook(() =>
      useCrossChapterPreload({
        chapter: 2,
        verse: 50, // Middle of chapter 2 (72 verses)
        enabled: true,
      })
    );

    // Should not trigger preload
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockPreloadAudio).not.toHaveBeenCalled();
  });

  it("should not preload when disabled", async () => {
    renderHook(() =>
      useCrossChapterPreload({
        chapter: 2,
        verse: 71, // Near end of chapter 2
        enabled: false,
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mockPreloadAudio).not.toHaveBeenCalled();
  });

  it("should preload when within threshold of chapter end", async () => {
    renderHook(() =>
      useCrossChapterPreload({
        chapter: 2,
        verse: 71, // 1 verse from end of chapter 2 (72 verses)
        enabled: true,
      })
    );

    // Wait for async preload to complete
    await waitFor(() => {
      expect(mockPreloadAudio).toHaveBeenCalledWith(
        "https://example.com/BG_3_1.mp3"
      );
    });
  });

  it("should not preload if already on last chapter", async () => {
    // Mock last chapter
    vi.doMock("../constants/chapters", () => ({
      getChapterInfo: () => ({ verses: 78 }),
      TOTAL_CHAPTERS: 18,
    }));

    renderHook(() =>
      useCrossChapterPreload({
        chapter: 18, // Last chapter
        verse: 77,
        enabled: true,
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 100));
    // Shouldn't preload because there's no chapter 19
    expect(mockPreloadAudio).not.toHaveBeenCalled();
  });
});
