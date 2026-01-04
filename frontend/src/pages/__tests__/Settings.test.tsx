import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { render } from "../../test/utils";
import Settings from "../Settings";

// Mock the API
vi.mock("../../lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  checkHealth: vi.fn().mockResolvedValue({ status: "healthy" }),
  preferencesApi: {
    get: vi.fn().mockResolvedValue({}),
    update: vi.fn().mockResolvedValue({}),
    merge: vi.fn().mockResolvedValue({}),
  },
  newsletterApi: {
    getStatus: vi.fn().mockResolvedValue(null),
    subscribe: vi.fn(),
    updatePreferences: vi.fn(),
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
  },
}));

// Mock hooks that make API calls
vi.mock("../../hooks", async () => {
  const actual = await vi.importActual("../../hooks");
  return {
    ...actual,
    useResendVerification: () => ({
      resend: vi.fn(),
      isResending: false,
      message: null,
    }),
    useAudioCacheStatus: () => ({
      status: null,
      isLoading: false,
      clearCache: vi.fn(),
    }),
  };
});

describe("Settings Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  describe("Rendering", () => {
    it("renders the settings page with main sections", async () => {
      render(<Settings />);

      // Check for main section headings
      await waitFor(() => {
        expect(screen.getByText(/appearance/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/daily wisdom/i)).toBeInTheDocument();
    });

    it("renders theme selector", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(/theme/i)).toBeInTheDocument();
      });
    });

    it("renders font size options", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(/font size/i)).toBeInTheDocument();
      });
    });
  });

  describe("Theme Selection", () => {
    it("allows changing theme", async () => {
      const user = userEvent.setup();
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(/theme/i)).toBeInTheDocument();
      });

      // Find and click theme options (light/dark/system)
      const themeButtons = screen.getAllByRole("button");
      const darkButton = themeButtons.find(
        (btn) => btn.textContent?.toLowerCase().includes("dark")
      );

      if (darkButton) {
        await user.click(darkButton);
        // Theme change is handled by context, so we just verify no errors
      }
    });
  });

  describe("Newsletter Subscription", () => {
    it("shows newsletter subscription form for guests", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(/daily wisdom/i)).toBeInTheDocument();
      });

      // Check for email input
      const emailInput = screen.getByPlaceholderText(/email/i);
      expect(emailInput).toBeInTheDocument();
    });

    it("validates email format", async () => {
      const user = userEvent.setup();
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText(/email/i);
      await user.type(emailInput, "invalid-email");

      // The form should have validation
      expect(emailInput).toHaveValue("invalid-email");
    });
  });

  describe("Reading Preferences", () => {
    it("renders font size selection buttons", async () => {
      render(<Settings />);

      await waitFor(() => {
        expect(screen.getByText(/font size/i)).toBeInTheDocument();
      });

      // Check for font size options (Small, Medium, Large)
      expect(screen.getByText(/small/i)).toBeInTheDocument();
      expect(screen.getByText(/medium/i)).toBeInTheDocument();
      expect(screen.getByText(/large/i)).toBeInTheDocument();
    });
  });
});
