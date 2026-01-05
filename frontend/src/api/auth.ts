import axios from "axios";
import type {
  AuthResponse,
  LoginRequest,
  SignupRequest,
  RefreshResponse,
  User,
} from "../types";
import { getSessionId } from "../lib/session";
import { API_BASE_URL } from "../lib/config";

// Create a separate axios instance for auth endpoints
const authClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/auth`,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Enable cookies for refresh token
  timeout: 10000, // 10 second timeout - prevents PWA hanging on flaky networks
  // Use default validateStatus (2xx = success, others throw)
  // 401 handling for refresh endpoint is done in the refresh() method
});

// Add session ID to auth requests for anonymous case migration
authClient.interceptors.request.use((config) => {
  const sessionId = getSessionId();
  config.headers["X-Session-ID"] = sessionId;
  return config;
});

// In-memory token storage with expiry tracking (more secure than localStorage for XSS attacks)
let accessToken: string | null = null;
let tokenExpiresAt: number | null = null;

/**
 * Parse JWT to extract expiry timestamp
 */
function getTokenExpirySeconds(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp; // Unix timestamp in seconds
    return exp - Math.floor(Date.now() / 1000);
  } catch {
    return 3600; // Default 1 hour if parsing fails
  }
}

// Session flag key - tracks whether user has explicitly logged out
// We use inverted logic: flag="0" means "known logged out", absence means "might have session"
// This ensures existing logged-in users aren't broken by this change
const LOGGED_OUT_KEY = "geetanjali_logged_out";

export const tokenStorage = {
  getToken: (): string | null => accessToken,

  setToken: (token: string | null): void => {
    accessToken = token;
    if (token) {
      const expiresInSeconds = getTokenExpirySeconds(token);
      // Set expiry 30 seconds earlier for safety margin
      tokenExpiresAt = Date.now() + (expiresInSeconds - 30) * 1000;
      // Clear logged-out flag on login (user now has a session)
      try {
        localStorage.removeItem(LOGGED_OUT_KEY);
      } catch {
        // localStorage may be unavailable in some contexts
      }
    } else {
      tokenExpiresAt = null;
    }
  },

  clearToken: (): void => {
    accessToken = null;
    tokenExpiresAt = null;
    // Mark as explicitly logged out - prevents 401 spam on page reload
    try {
      localStorage.setItem(LOGGED_OUT_KEY, "1");
    } catch {
      // localStorage may be unavailable
    }
  },

  /**
   * Clear in-memory token without marking as logged out
   * Used for transient errors (network issues) where user might still have valid session
   */
  clearTokenMemoryOnly: (): void => {
    accessToken = null;
    tokenExpiresAt = null;
    // Don't set logged_out flag - allow retry on next page load
  },

  /**
   * Check if this browser might have an active session
   * Returns true unless user has explicitly logged out or refresh returned null
   * This avoids 401 console errors for known anonymous users while
   * preserving existing sessions for users who logged in before this change
   */
  hasSession: (): boolean => {
    try {
      // Only skip refresh if we KNOW user logged out or has no session
      // Absence of flag = might have session (safe default for existing users)
      return localStorage.getItem(LOGGED_OUT_KEY) !== "1";
    } catch {
      return true; // Assume session exists to avoid breaking logins
    }
  },

  /**
   * Mark this browser as having no active session
   * Called when refresh returns null (anonymous user) to prevent future 401s
   */
  markNoSession: (): void => {
    try {
      localStorage.setItem(LOGGED_OUT_KEY, "1");
    } catch {
      // localStorage may be unavailable
    }
  },

  /**
   * Check if token needs refresh (expires in < 5 minutes)
   */
  needsRefresh: (): boolean => {
    if (!accessToken || !tokenExpiresAt) return false;
    // Refresh if token expires in < 5 minutes
    return Date.now() > tokenExpiresAt - 5 * 60 * 1000;
  },

  /**
   * Check if token is already expired
   */
  isExpired: (): boolean => {
    if (!accessToken || !tokenExpiresAt) return true;
    return Date.now() > tokenExpiresAt;
  },
};

/**
 * Authentication API
 *
 * Security design decisions:
 * 1. Access tokens stored in memory (not localStorage) to prevent XSS attacks
 * 2. Refresh tokens stored in httpOnly cookies (handled by backend)
 * 3. Token rotation on refresh for additional security
 * 4. Automatic token attachment via axios interceptor in main api client
 */
export const authApi = {
  /**
   * Sign up a new user
   */
  signup: async (data: SignupRequest): Promise<AuthResponse> => {
    const response = await authClient.post<AuthResponse>("/signup", data);
    // Store access token in memory
    tokenStorage.setToken(response.data.access_token);
    return response.data;
  },

  /**
   * Log in an existing user
   */
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await authClient.post<AuthResponse>("/login", data);
    // Store access token in memory
    tokenStorage.setToken(response.data.access_token);
    return response.data;
  },

  /**
   * Refresh the access token using the refresh token cookie
   *
   * Returns null if no valid refresh token exists (e.g., anonymous user)
   * This allows the caller to distinguish between "no refresh token" and other errors
   */
  refresh: async (): Promise<RefreshResponse | null> => {
    try {
      const response = await authClient.post<RefreshResponse>("/refresh");
      // Update access token in memory
      tokenStorage.setToken(response.data.access_token);
      return response.data;
    } catch (err) {
      // 401 (Unauthorized) means no valid refresh token - expected for anonymous users
      // Return null to indicate no session, let caller handle as non-error case
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        return null;
      }
      // Re-throw other errors (network issues, server errors, etc.)
      throw err;
    }
  },

  /**
   * Log out the current user
   */
  logout: async (): Promise<void> => {
    try {
      await authClient.post("/logout");
    } finally {
      // Always clear token even if request fails
      tokenStorage.clearToken();
    }
  },

  /**
   * Get current user profile
   */
  getCurrentUser: async (): Promise<User> => {
    const token = tokenStorage.getToken();
    if (!token) {
      throw new Error("No access token available");
    }

    const response = await authClient.get<User>("/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  /**
   * Request password reset email
   * Always returns success to prevent email enumeration
   */
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await authClient.post<{ message: string }>(
      "/forgot-password",
      { email },
    );
    return response.data;
  },

  /**
   * Reset password using token from email
   */
  resetPassword: async (
    token: string,
    password: string,
  ): Promise<{ message: string }> => {
    const response = await authClient.post<{ message: string }>(
      "/reset-password",
      { token, password },
    );
    return response.data;
  },
};
