import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import DailyVerse from "./DailyVerse";
import { AuthProvider } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";
import { PreferencesProvider } from "../contexts/PreferencesContext";
import { AudioPlayerProvider } from "../components/audio";
import * as api from "../lib/api";
import { tokenStorage } from "../api/auth";
import { mockVerse } from "../test/fixtures";
import type { ReactNode } from "react";

vi.mock("../lib/api", () => ({
  versesApi: {
    getDaily: vi.fn(),
  },
  preferencesApi: {
    get: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    merge: vi.fn().mockResolvedValue({}),
  },
}));

// Mock the auth API
vi.mock("../api/auth", () => ({
  authApi: {
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    refresh: vi.fn(),
  },
  tokenStorage: {
    getToken: vi.fn(),
    setToken: vi.fn(),
    clearToken: vi.fn(),
    needsRefresh: vi.fn(),
    isExpired: vi.fn(),
    hasSession: vi.fn(),
    markNoSession: vi.fn(),
    clearTokenMemoryOnly: vi.fn(),
  },
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <AuthProvider>
      <ThemeProvider>
        <PreferencesProvider>
          <AudioPlayerProvider>{children}</AudioPlayerProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </AuthProvider>
  </BrowserRouter>
);

describe("DailyVerse page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(tokenStorage.getToken).mockReturnValue(null);
  });

  it("shows today's verse from the daily endpoint", async () => {
    vi.mocked(api.versesApi.getDaily).mockResolvedValue(mockVerse);

    render(<DailyVerse />, { wrapper });

    expect(
      screen.getByRole("heading", { level: 1, name: "Verse of the Day" }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/कर्मण्येवाधिकारस्ते/)).toBeInTheDocument();
    });
    expect(api.versesApi.getDaily).toHaveBeenCalledTimes(1);
  });

  it("matches the crawler page's title and canonical", () => {
    vi.mocked(api.versesApi.getDaily).mockResolvedValue(mockVerse);

    render(<DailyVerse />, { wrapper });

    expect(document.title).toBe(
      "Bhagavad Gita Verse of the Day – Daily Quote | Geetanjali",
    );
    expect(
      document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
    ).toMatch(/\/daily$/);
  });

  it("does not print a date", async () => {
    vi.mocked(api.versesApi.getDaily).mockResolvedValue(mockVerse);

    const { container } = render(<DailyVerse />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText(/कर्मण्येवाधिकारस्ते/)).toBeInTheDocument();
    });
    // Scoped to <main>: the footer carries a copyright year.
    expect(container.querySelector("main")?.textContent).not.toMatch(
      /\b20\d\d\b|January|February|March|April|May|June|July|August|September|October|November|December/,
    );
  });

  it("degrades without crashing when the verse fails to load", async () => {
    vi.mocked(api.versesApi.getDaily).mockRejectedValue(new Error("down"));

    render(<DailyVerse />, { wrapper });

    await waitFor(() => {
      expect(api.versesApi.getDaily).toHaveBeenCalled();
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "Verse of the Day" }),
    ).toBeInTheDocument();
  });
});
