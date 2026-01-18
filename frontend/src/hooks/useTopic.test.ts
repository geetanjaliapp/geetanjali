import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTopic, clearTopicCache } from "./useTopic";
import { topicsApi } from "../lib/api";
import type { TopicDetailResponse } from "../lib/api";

// Mock the API
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return {
    ...actual,
    topicsApi: {
      getAll: vi.fn(),
      getById: vi.fn(),
    },
  };
});

const mockTopicDetail: TopicDetailResponse = {
  id: "dharma",
  label: "Righteous Duty",
  shortLabel: "Duty",
  sanskrit: "धर्म",
  transliteration: "Dharma",
  description: "Honor your responsibilities with integrity.",
  leadershipContext: "In leadership, dharma means...",
  group: {
    id: "karma",
    label: "Karma Yoga",
    transliteration: "योग",
  },
  extendedDescription: "Extended description of dharma...",
  practicalApplication: "Practical application...",
  commonMisconceptions: "Common misconceptions...",
  faq: {
    question: "What is dharma?",
    answer: "Dharma means righteous duty...",
  },
  relatedPrinciples: [
    { id: "nishkama_karma", label: "Selfless Action", shortLabel: "Selfless" },
  ],
  chapterFocus: [2, 3, 18],
  keywords: ["duty", "righteousness"],
  verseCount: 24,
  verses: [
    {
      canonicalId: "bg_2_47",
      chapter: 2,
      verse: 47,
      sanskritDevanagari: "कर्मण्येवाधिकारस्ते",
      paraphraseEn: "You have the right to work...",
      hasAudio: true,
    },
  ],
};

describe("useTopic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTopicCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles null topic ID gracefully", () => {
    const { result } = renderHook(() => useTopic(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.topic).toBeNull();
    expect(result.current.error).toBeNull();
    expect(topicsApi.getById).not.toHaveBeenCalled();
  });

  it("handles undefined topic ID gracefully", () => {
    const { result } = renderHook(() => useTopic(undefined));

    expect(result.current.loading).toBe(false);
    expect(result.current.topic).toBeNull();
    expect(result.current.error).toBeNull();
    expect(topicsApi.getById).not.toHaveBeenCalled();
  });

  it("fetches and returns topic data", async () => {
    vi.mocked(topicsApi.getById).mockResolvedValue(mockTopicDetail);

    const { result } = renderHook(() => useTopic("dharma"));

    // Initially loading
    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.topic).not.toBeNull();
    });

    expect(result.current.topic?.id).toBe("dharma");
    expect(result.current.topic?.sanskrit).toBe("धर्म");
    expect(result.current.loading).toBe(false);
  });

  it("handles API errors gracefully", async () => {
    vi.mocked(topicsApi.getById).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useTopic("dharma"));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.topic).toBeNull();
  });

  it("respects includeVerses option", async () => {
    vi.mocked(topicsApi.getById).mockResolvedValue(mockTopicDetail);

    renderHook(() => useTopic("dharma", { includeVerses: false }));

    await waitFor(() => {
      expect(topicsApi.getById).toHaveBeenCalled();
    });

    expect(topicsApi.getById).toHaveBeenCalledWith("dharma", {
      includeVerses: false,
    });
  });

  it("provides refetch function", async () => {
    vi.mocked(topicsApi.getById).mockResolvedValue(mockTopicDetail);

    const { result } = renderHook(() => useTopic("dharma"));

    await waitFor(() => {
      expect(result.current.topic).not.toBeNull();
    });

    expect(result.current.refetch).toBeDefined();
    expect(typeof result.current.refetch).toBe("function");
  });

  it("returns loading state initially when fetching", () => {
    // Use a promise that doesn't resolve immediately
    vi.mocked(topicsApi.getById).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockTopicDetail), 100);
        }),
    );

    const { result } = renderHook(() => useTopic("dharma"));
    expect(result.current.loading).toBe(true);
    expect(result.current.topic).toBeNull();
  });
});
