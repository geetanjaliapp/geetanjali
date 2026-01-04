import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { render } from "../../test/utils";
import VerseDetail from "../VerseDetail";

/**
 * VerseDetail Page Tests
 *
 * Minimal smoke tests for page rendering. The component has complex dependencies:
 * - Router params (canonical_id)
 * - Multiple API calls (verse data, translations, adjacent verses)
 * - Audio player context for recitation
 * - Favorites and sharing functionality
 *
 * These tests verify the page renders without crashing. More detailed tests
 * would require comprehensive mock infrastructure for all dependencies.
 */

// Mock react-router-dom params
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "BG_2_47" }),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock the API
vi.mock("../../lib/api", () => ({
  versesApi: {
    get: vi.fn().mockResolvedValue({
      id: "verse-1",
      canonical_id: "BG_2_47",
      chapter: 2,
      verse: 47,
      sanskrit_iast: "karmaṇy evādhikāras te",
      sanskrit_devanagari: "कर्मण्येवाधिकारस्ते",
      translation_en: "You have the right to action alone.",
      paraphrase_en: "Focus on your duties without attachment.",
      consulting_principles: ["Focus on action"],
      source: "Bhagavad Geeta",
      license: "Public Domain",
      is_featured: true,
    }),
    getTranslations: vi.fn().mockResolvedValue([
      {
        id: "trans-1",
        text: "You have a right to perform your prescribed duties.",
        translator: "Swami Prabhupada",
        language: "en",
      },
    ]),
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

// Mock hooks
vi.mock("../../hooks", async () => {
  const actual = await vi.importActual("../../hooks");
  return {
    ...actual,
    useAdjacentVerses: () => ({
      prev: { canonical_id: "BG_2_46", chapter: 2, verse: 46 },
      next: { canonical_id: "BG_2_48", chapter: 2, verse: 48 },
      isLoading: false,
    }),
    useFavoritesPrefs: () => ({
      isFavorite: false,
      toggleFavorite: vi.fn(),
      fontSize: "regular",
    }),
  };
});

describe("VerseDetail Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("Rendering", () => {
    it("renders the page without crashing", async () => {
      render(<VerseDetail />);

      // Smoke test: verify page renders with substantial content
      // This is intentionally minimal - checking that providers initialize
      // and the component tree renders without throwing
      await waitFor(() => {
        expect(document.body.innerHTML.length).toBeGreaterThan(100);
      });
    });

    it("renders navigation elements", async () => {
      render(<VerseDetail />);

      // Check for navigation - should have links
      await waitFor(
        () => {
          const links = screen.getAllByRole("link");
          expect(links.length).toBeGreaterThan(0);
        },
        { timeout: 2000 },
      );
    });
  });
});
