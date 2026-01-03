import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStudyMode, SECTION_LABELS } from "./useStudyMode";
import type { Verse, Translation } from "../types";

// Mock dependencies
vi.mock("../components/audio", () => ({
  useAudioPlayer: vi.fn(() => ({
    state: "idle",
    currentlyPlaying: null,
    play: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock("../contexts/TTSContext", () => ({
  useTTSContext: vi.fn(() => ({
    speak: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    currentText: null,
    loadingText: null,
  })),
}));

// Mock API to prevent loading axios/auth interceptors
vi.mock("../lib/api", () => ({
  versesApi: { getTranslations: vi.fn().mockResolvedValue([]) },
}));

vi.mock("../lib/ttsPreprocess", () => ({
  prepareHindiTTS: vi.fn((text) => text || ""),
  prepareEnglishTTS: vi.fn((text) => text || ""),
}));

// Stable empty array reference - inline [] creates new ref each render,
// causing infinite effect loops in hooks with array dependencies
const EMPTY_TRANSLATIONS: Translation[] = [];

describe("useStudyMode", () => {
  const mockVerse: Verse = {
    id: "verse-1",
    canonical_id: "BG_2_47",
    chapter: 2,
    verse: 47,
    sanskrit_devanagari: "कर्मण्येवाधिकारस्ते",
    sanskrit_iast: "karmaṇy evādhikāras te",
    translation_en: "You have the right to work only",
    paraphrase_en: "Focus on actions, not results",
    audio_url: "https://example.com/audio.mp3",
    created_at: "2024-01-01T00:00:00Z",
  };

  const mockTranslations: Translation[] = [
    {
      id: "t1",
      verse_id: "verse-1",
      language: "en",
      text: "English translation text",
    },
    {
      id: "t2",
      verse_id: "verse-1",
      language: "hi",
      text: "Hindi translation text",
    },
  ];

  const emptyVerse: Verse = {
    id: "verse-2",
    canonical_id: "BG_1_1",
    chapter: 1,
    verse: 1,
    created_at: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with idle state", () => {
    const { result } = renderHook(() =>
      useStudyMode({ verse: mockVerse, translations: mockTranslations })
    );

    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.currentSection).toBeNull();
    expect(result.current.canStart).toBe(true);
  });

  it("should detect available sections", () => {
    const { result } = renderHook(() =>
      useStudyMode({ verse: mockVerse, translations: mockTranslations })
    );

    // Should have all 4 sections: sanskrit (audio), english, hindi, insight
    expect(result.current.state.availableSections).toContain("sanskrit");
    expect(result.current.state.availableSections).toContain("english");
    expect(result.current.state.availableSections).toContain("hindi");
    expect(result.current.state.availableSections).toContain("insight");
  });

  it("should not allow start if no sections available", () => {
    const { result } = renderHook(() =>
      useStudyMode({ verse: emptyVerse, translations: EMPTY_TRANSLATIONS })
    );

    expect(result.current.canStart).toBe(false);
  });

  it("should start study mode on start()", () => {
    const { result } = renderHook(() =>
      useStudyMode({ verse: mockVerse, translations: mockTranslations })
    );

    act(() => {
      result.current.start();
    });

    expect(result.current.state.status).toBe("playing");
    expect(result.current.state.currentSection).toBe("sanskrit");
    expect(result.current.state.currentIndex).toBe(0);
  });

  it("should stop study mode on stop()", () => {
    const { result } = renderHook(() =>
      useStudyMode({ verse: mockVerse, translations: mockTranslations })
    );

    act(() => {
      result.current.start();
    });

    act(() => {
      result.current.stop();
    });

    expect(result.current.state.status).toBe("idle");
    expect(result.current.state.currentSection).toBeNull();
  });

  it("should have section labels for all sections", () => {
    expect(SECTION_LABELS.sanskrit).toBe("Sanskrit");
    expect(SECTION_LABELS.english).toBe("English");
    expect(SECTION_LABELS.hindi).toBe("Hindi");
    expect(SECTION_LABELS.insight).toBe("Insight");
  });
});
