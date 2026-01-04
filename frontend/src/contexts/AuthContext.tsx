import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import type { ReactNode } from "react";
import type { User, LoginRequest, SignupRequest } from "../types";
import { authApi, tokenStorage } from "../api/auth";
import { clearAllLocalStorage, clearAllSessionStorage } from "../lib/storage";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount, check if we have a valid session (via refresh token cookie)
  useEffect(() => {
    const initAuth = async () => {
      const token = tokenStorage.getToken();
      if (token) {
        // We have an in-memory token, try to use it
        try {
          const currentUser = await authApi.getCurrentUser();
          setUser(currentUser);
          setLoading(false);
          return;
        } catch {
          // Token invalid or expired, clear it and try refresh
          tokenStorage.clearToken();
        }
      }

      // No in-memory token (or it was invalid), try to refresh from httpOnly cookie
      // This handles page refresh where in-memory token is lost but cookie persists
      // Only attempt refresh if user might have a session (avoids 401 console error for known anonymous)
      if (tokenStorage.hasSession()) {
        try {
          const refreshResult = await authApi.refresh();
          // refresh() returns null for anonymous users (no refresh token)
          // This is normal and expected - user stays anonymous
          if (refreshResult) {
            const currentUser = await authApi.getCurrentUser();
            setUser(currentUser);
          } else {
            // No refresh token = anonymous user, mark to skip future refresh attempts
            tokenStorage.markNoSession();
          }
        } catch {
          // Transient errors (network, 500, etc.) - clear in-memory token but allow retry
          // Don't mark as logged out since user might have valid session
          tokenStorage.clearTokenMemoryOnly();
        }
      }
      setLoading(false);
    };

    // Safety timeout: ensure app renders even if auth hangs (PWA standalone mode edge cases)
    const safetyTimeout = setTimeout(() => {
      console.warn("[Auth] Safety timeout - proceeding as anonymous");
      setLoading(false);
    }, 15000);

    initAuth().finally(() => clearTimeout(safetyTimeout));
  }, []);

  // P2.5 FIX: Wrap handlers in useCallback to prevent unnecessary re-renders
  const login = useCallback(async (credentials: LoginRequest) => {
    const response = await authApi.login(credentials);
    setUser(response.user);
  }, []);

  const signup = useCallback(async (data: SignupRequest) => {
    const response = await authApi.signup(data);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();

    // Clear all user data from localStorage for fresh guest state
    // This ensures the next guest session starts clean
    clearAllLocalStorage();
    clearAllSessionStorage();

    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await authApi.getCurrentUser();
      setUser(currentUser);
    } catch {
      // If refresh fails, user might have been logged out
      tokenStorage.clearToken();
      setUser(null);
    }
  }, []);

  // P2.5 FIX: Memoize context value to prevent re-renders when value object changes
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      login,
      signup,
      logout,
      refreshUser,
      isAuthenticated: !!user,
    }),
    [user, loading, login, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
