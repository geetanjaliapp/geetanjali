import axios from 'axios';
import type { AuthResponse, LoginRequest, SignupRequest, RefreshResponse, User } from '../types';
import { getSessionId } from '../lib/session';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Create a separate axios instance for auth endpoints
const authClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1/auth`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for refresh token
});

// Add session ID to auth requests for anonymous case migration
authClient.interceptors.request.use((config) => {
  const sessionId = getSessionId();
  config.headers['X-Session-ID'] = sessionId;
  return config;
});

// In-memory token storage (more secure than localStorage for XSS attacks)
let accessToken: string | null = null;

export const tokenStorage = {
  getToken: (): string | null => accessToken,
  setToken: (token: string | null): void => {
    accessToken = token;
  },
  clearToken: (): void => {
    accessToken = null;
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
    const response = await authClient.post<AuthResponse>('/signup', data);
    // Store access token in memory
    tokenStorage.setToken(response.data.access_token);
    return response.data;
  },

  /**
   * Log in an existing user
   */
  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await authClient.post<AuthResponse>('/login', data);
    // Store access token in memory
    tokenStorage.setToken(response.data.access_token);
    return response.data;
  },

  /**
   * Refresh the access token using the refresh token cookie
   */
  refresh: async (): Promise<RefreshResponse> => {
    const response = await authClient.post<RefreshResponse>('/refresh');
    // Update access token in memory
    tokenStorage.setToken(response.data.access_token);
    return response.data;
  },

  /**
   * Log out the current user
   */
  logout: async (): Promise<void> => {
    try {
      await authClient.post('/logout');
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
      throw new Error('No access token available');
    }

    const response = await authClient.get<User>('/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },
};
