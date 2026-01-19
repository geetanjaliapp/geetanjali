import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useTopics, clearTopicsCache } from "./useTopics";
import { topicsApi } from "../lib/api";
import type { TopicsListResponse } from "../lib/api";

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

const mockTopicsResponse: TopicsListResponse = {
  groups: [
    {
      id: "karma",
      label: "Karma",
      sanskrit: "कर्म",
      description: "Path of Action",
      transliteration: "योग",
      principles: [
        {
          id: "dharma",
          label: "Righteous Duty",
          shortLabel: "Duty",
          sanskrit: "धर्म",
          transliteration: "Dharma",
          description: "Honor your responsibilities.",
          verseCount: 24,
        },
      ],
    },
    {
      id: "jnana",
      label: "Jnana",
      sanskrit: "ज्ञान",
      description: "Path of Knowledge",
      transliteration: "ज्ञान",
      principles: [
        {
          id: "jnana",
          label: "True Knowledge",
          shortLabel: "Knowledge",
          sanskrit: "ज्ञान",
          transliteration: "Jñāna",
          description: "Understanding of reality.",
          verseCount: 18,
        },
      ],
    },
  ],
  totalPrinciples: 2,
  totalVerses: 42,
};

describe("useTopics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear the topics cache to reset cached data between tests
    clearTopicsCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns loading state initially", async () => {
    vi.mocked(topicsApi.getAll).mockImplementation(
      () => new Promise(() => {}), // Never resolves
    );

    const { result } = renderHook(() => useTopics());
    expect(result.current.loading).toBe(true);
    expect(result.current.groups).toEqual([]);
  });

  it("fetches and returns topics data", async () => {
    vi.mocked(topicsApi.getAll).mockResolvedValue(mockTopicsResponse);

    const { result } = renderHook(() => useTopics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.groups).toHaveLength(2);
    expect(result.current.totalPrinciples).toBe(2);
    expect(result.current.totalVerses).toBe(42);
  });

  it("provides getGroup helper", async () => {
    vi.mocked(topicsApi.getAll).mockResolvedValue(mockTopicsResponse);

    const { result } = renderHook(() => useTopics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const karmaGroup = result.current.getGroup("karma");
    expect(karmaGroup?.label).toBe("Karma");

    const unknown = result.current.getGroup("unknown");
    expect(unknown).toBeUndefined();
  });

  it("provides getPrinciple helper", async () => {
    vi.mocked(topicsApi.getAll).mockResolvedValue(mockTopicsResponse);

    const { result } = renderHook(() => useTopics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const dharma = result.current.getPrinciple("dharma");
    expect(dharma?.label).toBe("Righteous Duty");

    const unknown = result.current.getPrinciple("unknown");
    expect(unknown).toBeUndefined();
  });

  it("provides getAllPrinciples helper", async () => {
    vi.mocked(topicsApi.getAll).mockResolvedValue(mockTopicsResponse);

    const { result } = renderHook(() => useTopics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const allPrinciples = result.current.getAllPrinciples();
    expect(allPrinciples).toHaveLength(2);
    expect(allPrinciples.map((p) => p.id)).toEqual(["dharma", "jnana"]);
  });

  it("handles API errors gracefully", async () => {
    vi.mocked(topicsApi.getAll).mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useTopics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.groups).toEqual([]);
  });
});
