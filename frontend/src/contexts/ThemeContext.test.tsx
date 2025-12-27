import {
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll,
  vi,
  afterEach,
} from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./ThemeContext";
import { AuthProvider } from "./AuthContext";
import type { ReactNode } from "react";
import type { ThemeConfig } from "../types/theme";

// Suppress console errors from async cleanup during tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: An update to")
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Mock matchMedia
const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// ThemeProvider now requires AuthProvider context for backend sync
const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>
    <ThemeProvider>{children}</ThemeProvider>
  </AuthProvider>
);

describe("ThemeContext", () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset matchMedia mock
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia,
    });
    // Clean up any theme style elements
    const styleEl = document.getElementById("custom-theme-overrides");
    if (styleEl) {
      styleEl.remove();
    }
  });

  afterEach(async () => {
    cleanup();
    vi.resetAllMocks();
    // Allow any pending async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  describe("useTheme hook", () => {
    it("should throw error when used outside ThemeProvider", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow("useTheme must be used within a ThemeProvider");

      consoleSpy.mockRestore();
    });

    it("should provide default theme state", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe("system");
      expect(result.current.resolvedTheme).toBe("light"); // matchMedia returns false for dark
      expect(result.current.customTheme).toBeNull();
      expect(result.current.availableThemes).toBeDefined();
      expect(result.current.availableThemes.length).toBeGreaterThan(0);
    });
  });

  describe("theme mode switching", () => {
    it("should switch to light mode", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme("light");
      });

      expect(result.current.theme).toBe("light");
      expect(result.current.resolvedTheme).toBe("light");
      expect(localStorage.getItem("geetanjali:theme")).toBe("light");
    });

    it("should switch to dark mode", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme("dark");
      });

      expect(result.current.theme).toBe("dark");
      expect(result.current.resolvedTheme).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("should switch to system mode", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme("system");
      });

      expect(result.current.theme).toBe("system");
      // Resolved theme depends on matchMedia mock (returns light)
      expect(result.current.resolvedTheme).toBe("light");
    });

    it("should cycle through themes", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      // Start at system, cycle should go: system -> light
      act(() => {
        result.current.setTheme("light");
      });
      expect(result.current.theme).toBe("light");

      // light -> dark
      act(() => {
        result.current.cycleTheme();
      });
      expect(result.current.theme).toBe("dark");

      // dark -> system
      act(() => {
        result.current.cycleTheme();
      });
      expect(result.current.theme).toBe("system");

      // system -> light
      act(() => {
        result.current.cycleTheme();
      });
      expect(result.current.theme).toBe("light");
    });

    it("should persist theme to localStorage", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setTheme("dark");
      });

      expect(localStorage.getItem("geetanjali:theme")).toBe("dark");
    });

    it("should restore theme from localStorage", () => {
      localStorage.setItem("geetanjali:theme", "dark");

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe("dark");
      expect(result.current.resolvedTheme).toBe("dark");
    });
  });

  describe("custom theme management", () => {
    const testTheme: ThemeConfig = {
      id: "test-theme",
      name: "Test Theme",
      colors: {
        primary: {
          500: "#ff0000",
          600: "#cc0000",
        },
      },
    };

    it("should set custom theme", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setCustomTheme(testTheme);
      });

      expect(result.current.customTheme).toEqual(testTheme);
    });

    it("should apply custom theme CSS", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setCustomTheme(testTheme);
      });

      const styleEl = document.getElementById("custom-theme-overrides");
      expect(styleEl).not.toBeNull();
      expect(styleEl?.textContent).toContain("--color-primary-500: #ff0000;");
    });

    it("should clear custom theme when set to null", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => {
        result.current.setCustomTheme(testTheme);
      });
      expect(result.current.customTheme).not.toBeNull();

      act(() => {
        result.current.setCustomTheme(null);
      });

      expect(result.current.customTheme).toBeNull();
      expect(document.getElementById("custom-theme-overrides")).toBeNull();
    });

    it("should set theme by ID from built-in themes", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      // Get a built-in theme ID (not default)
      const builtInTheme = result.current.availableThemes.find(
        (t) => t.id !== "default",
      );

      if (builtInTheme) {
        act(() => {
          result.current.setCustomThemeById(builtInTheme.id);
        });

        expect(result.current.customTheme?.id).toBe(builtInTheme.id);
      }
    });

    it("should clear theme when setting to default ID", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      // First set a custom theme
      act(() => {
        result.current.setCustomTheme(testTheme);
      });
      expect(result.current.customTheme).not.toBeNull();

      // Then set to default
      act(() => {
        result.current.setCustomThemeById("default");
      });

      expect(result.current.customTheme).toBeNull();
    });

    it("should persist theme ID to localStorage", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      const builtInTheme = result.current.availableThemes.find(
        (t) => t.id !== "default",
      );

      if (builtInTheme) {
        act(() => {
          result.current.setCustomThemeById(builtInTheme.id);
        });

        expect(localStorage.getItem("geetanjali:theme-id")).toBe(
          builtInTheme.id,
        );
      }
    });
  });

  describe("system theme detection", () => {
    it("should detect dark mode from system preference", () => {
      // Mock matchMedia to return dark mode
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: query === "(prefers-color-scheme: dark)",
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe("system");
      expect(result.current.resolvedTheme).toBe("dark");
    });

    it("should detect light mode from system preference", () => {
      // Mock matchMedia to return light mode
      mockMatchMedia.mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.theme).toBe("system");
      expect(result.current.resolvedTheme).toBe("light");
    });
  });

  describe("availableThemes", () => {
    it("should provide built-in themes", () => {
      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.availableThemes).toBeInstanceOf(Array);
      expect(result.current.availableThemes.length).toBeGreaterThanOrEqual(1);

      // Each theme should have required properties
      result.current.availableThemes.forEach((theme) => {
        expect(theme.id).toBeDefined();
        expect(theme.name).toBeDefined();
      });
    });
  });
});
