import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../test/utils";
import Verses from "../Verses";

/**
 * Verses Page Tests
 *
 * These are minimal smoke tests due to the component's complex dependencies:
 * - Multiple API calls (versesApi.list, count, search)
 * - Taxonomy context for filtering
 * - Complex state management for infinite scroll, search, filters
 *
 * Full integration tests would require extensive mocking infrastructure.
 * These tests verify the page renders and basic interactions work.
 */

// Mock the API - versesApi.list returns Verse[] array directly
vi.mock("../../lib/api", () => ({
  versesApi: {
    list: vi.fn().mockResolvedValue([
      {
        id: "verse-1",
        canonical_id: "BG_2_47",
        chapter: 2,
        verse: 47,
        sanskrit_iast: "karmaṇy evādhikāras te",
        sanskrit_devanagari: "कर्मण्येवाधिकारस्ते",
        translation_en: "You have the right to action",
        paraphrase_en: "Focus on your duties",
        consulting_principles: ["Focus on action"],
        is_featured: true,
      },
    ]),
    search: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(108),
  },
  checkHealth: vi.fn().mockResolvedValue({ status: "healthy" }),
  preferencesApi: {
    get: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    merge: vi.fn().mockResolvedValue({}),
  },
  api: {
    get: vi.fn(),
  },
}));

// Mock the auth API
vi.mock("../../api/auth", () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    refresh: vi.fn(),
  },
  tokenStorage: {
    getToken: vi.fn().mockReturnValue(null),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    needsRefresh: vi.fn().mockReturnValue(false),
    isExpired: vi.fn().mockReturnValue(false),
    hasSession: vi.fn().mockReturnValue(false),
    markNoSession: vi.fn(),
    clearTokenMemoryOnly: vi.fn(),
  },
}));

// Mock useTaxonomy hook
vi.mock("../../hooks", async () => {
  const actual = await vi.importActual("../../hooks");
  return {
    ...actual,
    useTaxonomy: () => ({
      principles: [
        { id: "focus_on_action", label: "Focus on Action" },
        { id: "detachment", label: "Detachment" },
      ],
      goals: [],
      getPrincipleShortLabel: (id: string) => id,
      isLoading: false,
    }),
  };
});

describe("Verses Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("Rendering", () => {
    it("renders search input", async () => {
      render(<Verses />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      });
    });

    it("renders page container", async () => {
      render(<Verses />);

      // Page should render with navigation elements
      await waitFor(() => {
        const links = screen.getAllByRole("link");
        expect(links.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Search Functionality", () => {
    it("allows entering search query", async () => {
      const user = userEvent.setup();
      render(<Verses />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search/i);
      await user.type(searchInput, "karma");

      expect(searchInput).toHaveValue("karma");
    });
  });
});
