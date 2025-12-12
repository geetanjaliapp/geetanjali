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
  // Treat 401 as a valid response (not an error) to suppress console logging
  // This is expected for anonymous users who don't have a refresh token
  validateStatus: (status) => status !== 401 || true, // Accept all status codes
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

export const tokenStorage = {
  getToken: (): string | null => accessToken,

  setToken: (token: string | null): void => {
    accessToken = token;
    if (token) {
      const expiresInSeconds = getTokenExpirySeconds(token);
      // Set expiry 30 seconds earlier for safety margin
      tokenExpiresAt = Date.now() + (expiresInSeconds - 30) * 1000;
    } else {
      tokenExpiresAt = null;
    }
  },

  clearToken: (): void => {
    accessToken = null;
    tokenExpiresAt = null;
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
    const response = await authClient.post<RefreshResponse>("/refresh");

    // If 401 (Unauthorized), no valid refresh token exists - treat as expected for anonymous users
    // Return null to indicate no refresh token, let caller handle as non-error case
    if (response.status === 401) {
      return null;
    }

    // Update access token in memory
    tokenStorage.setToken(response.data.access_token);
    return response.data;
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
