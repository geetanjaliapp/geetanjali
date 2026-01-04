import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./AuthContext";
import { authApi, tokenStorage } from "../api/auth";
import { mockUser } from "../test/fixtures";
import type { ReactNode } from "react";

// Mock the auth API module
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
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthContext", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: no token
    vi.mocked(tokenStorage.getToken).mockReturnValue(null);
  });

  describe("useAuth hook", () => {
    it("should throw error when used outside AuthProvider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow("useAuth must be used within an AuthProvider");

      consoleSpy.mockRestore();
    });

    it("should provide initial state with no user", async () => {
      // Mock refresh to fail (no valid refresh token)
      vi.mocked(authApi.refresh).mockRejectedValue(
        new Error("No refresh token"),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("initialization with existing token", () => {
    it("should fetch user when token exists", async () => {
      vi.mocked(tokenStorage.getToken).mockReturnValue("valid-token");
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(authApi.getCurrentUser).toHaveBeenCalled();
    });

    it("should try refresh when getCurrentUser fails with in-memory token", async () => {
      vi.mocked(tokenStorage.getToken).mockReturnValue("invalid-token");
      vi.mocked(tokenStorage.hasSession).mockReturnValue(true); // User has logged in before
      vi.mocked(authApi.getCurrentUser).mockRejectedValueOnce(
        new Error("Unauthorized"),
      );
      vi.mocked(authApi.refresh).mockRejectedValue(
        new Error("No refresh token"),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(tokenStorage.clearToken).toHaveBeenCalled();
      expect(authApi.refresh).toHaveBeenCalled();
    });

    it("should restore session from refresh token cookie on page reload", async () => {
      // Simulates page reload: no in-memory token but valid refresh token cookie
      vi.mocked(tokenStorage.getToken).mockReturnValue(null);
      vi.mocked(tokenStorage.hasSession).mockReturnValue(true); // User has logged in before
      vi.mocked(authApi.refresh).mockResolvedValue({
        access_token: "new-token",
        token_type: "bearer",
      });
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(authApi.refresh).toHaveBeenCalled();
      expect(authApi.getCurrentUser).toHaveBeenCalled();
    });

    it("should remain logged out when no token and refresh fails", async () => {
      vi.mocked(tokenStorage.getToken).mockReturnValue(null);
      vi.mocked(tokenStorage.hasSession).mockReturnValue(true); // User has logged in before
      vi.mocked(authApi.refresh).mockRejectedValue(
        new Error("Network error"),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      // Transient errors use clearTokenMemoryOnly (allows retry on next page load)
      expect(tokenStorage.clearTokenMemoryOnly).toHaveBeenCalled();
    });
  });

  describe("login", () => {
    it("should set user after successful login", async () => {
      // Mock refresh to fail during initialization (user not logged in yet)
      vi.mocked(authApi.refresh).mockRejectedValue(
        new Error("No refresh token"),
      );
      vi.mocked(authApi.login).mockResolvedValue({
        access_token: "new-token",
        token_type: "bearer",
        user: mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.login({
          email: "test@example.com",
          password: "password",
        });
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(authApi.login).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password",
      });
    });

    it("should throw error on login failure", async () => {
      // Mock refresh to fail during initialization
      vi.mocked(authApi.refresh).mockRejectedValue(
        new Error("No refresh token"),
      );
      const loginError = new Error("Invalid credentials");
      vi.mocked(authApi.login).mockRejectedValue(loginError);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.login({
            email: "test@example.com",
            password: "wrong",
          });
        }),
      ).rejects.toThrow("Invalid credentials");

      expect(result.current.user).toBeNull();
    });
  });

  describe("signup", () => {
    it("should set user after successful signup", async () => {
      // Mock refresh to fail during initialization (user not signed up yet)
      vi.mocked(authApi.refresh).mockRejectedValue(
        new Error("No refresh token"),
      );
      vi.mocked(authApi.signup).mockResolvedValue({
        access_token: "new-token",
        token_type: "bearer",
        user: mockUser,
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signup({
          email: "test@example.com",
          name: "Test User",
          password: "password123",
        });
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it("should throw error on signup failure", async () => {
      // Mock refresh to fail during initialization
      vi.mocked(authApi.refresh).mockRejectedValue(
        new Error("No refresh token"),
      );
      vi.mocked(authApi.signup).mockRejectedValue(
        new Error("Email already exists"),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.signup({
            email: "existing@example.com",
            name: "Test",
            password: "password",
          });
        }),
      ).rejects.toThrow("Email already exists");
    });
  });

  describe("logout", () => {
    it("should clear user after logout", async () => {
      // Start logged in
      vi.mocked(tokenStorage.getToken).mockReturnValue("valid-token");
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(authApi.logout).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(authApi.logout).toHaveBeenCalled();
    });

    it("should not clear user if logout API fails", async () => {
      // Note: Current implementation does NOT clear user on logout failure
      // The authApi.logout() has try/finally that clears token, but AuthContext.logout()
      // calls setUser(null) after authApi.logout(), so if API throws, user is NOT cleared
      vi.mocked(tokenStorage.getToken).mockReturnValue("valid-token");
      vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);
      vi.mocked(authApi.logout).mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
      });

      // Logout should throw the error
      await expect(
        act(async () => {
          await result.current.logout();
        }),
      ).rejects.toThrow("Network error");

      // User is NOT cleared because the error was thrown before setUser(null)
      // This is the actual current behavior
      expect(result.current.user).toEqual(mockUser);
    });
  });
});
