import axios from 'axios';
import type { Case, Output, Verse, Translation, HealthResponse, ScholarReviewRequest, Feedback, FeedbackCreate, Message } from '../types';
import { tokenStorage, authApi } from '../api/auth';
import { getSessionId } from './session';

// In production (Docker), use relative paths - nginx proxies /api/ to backend
// In development, use localhost:8000 for direct backend access
const API_BASE_URL = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000');
const API_V1_PREFIX = import.meta.env.VITE_API_V1_PREFIX || '/api/v1';

export const api = axios.create({
  baseURL: `${API_BASE_URL}${API_V1_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Enable cookies for CSRF
});

// Token refresh queue management to prevent race conditions
let isRefreshing = false;
let refreshQueue: Array<{
  resolve: (token: string | null) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  refreshQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  refreshQueue = [];
};

/**
 * Read CSRF token from cookie
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

// Request interceptor with proactive token refresh
api.interceptors.request.use(
  async (config) => {
    // Skip token refresh for auth endpoints
    const isAuthEndpoint = config.url?.includes('/auth/');

    // Proactive token refresh: check if token needs refresh before request
    if (!isAuthEndpoint && tokenStorage.getToken() && tokenStorage.needsRefresh()) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          await authApi.refresh();
          processQueue(null, tokenStorage.getToken());
        } catch (error) {
          processQueue(error as Error, null);
          tokenStorage.clearToken();
        } finally {
          isRefreshing = false;
        }
      } else {
        // Wait for ongoing refresh to complete
        await new Promise<string | null>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        });
      }
    }

    // Attach auth token only if available and non-empty
    const token = tokenStorage.getToken();
    if (token && token.trim().length > 0) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Always attach session ID for anonymous user tracking
    const sessionId = getSessionId();
    config.headers['X-Session-ID'] = sessionId;

    // Attach CSRF token for state-changing requests
    const method = config.method?.toLowerCase();
    if (method && ['post', 'put', 'patch', 'delete'].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract error message from API response
    if (error.response?.data?.detail) {
      error.message = error.response.data.detail;
    }
    return Promise.reject(error);
  }
);

// Health check endpoint
export const checkHealth = async (): Promise<HealthResponse> => {
  const response = await axios.get(`${API_BASE_URL}/health`);
  return response.data;
};

// Cases API
export const casesApi = {
  create: async (caseData: Omit<Case, 'id' | 'created_at'>): Promise<Case> => {
    const response = await api.post('/cases', caseData);
    return response.data;
  },

  get: async (id: string): Promise<Case> => {
    const response = await api.get(`/cases/${id}`);
    return response.data;
  },

  list: async (skip = 0, limit = 100): Promise<Case[]> => {
    const response = await api.get('/cases', { params: { skip, limit } });
    return response.data;
  },

  analyze: async (id: string): Promise<Output> => {
    const response = await api.post(`/cases/${id}/analyze`);
    return response.data;
  },

  // Async analyze - returns immediately, poll case status for completion
  analyzeAsync: async (id: string): Promise<Case> => {
    const response = await api.post(`/cases/${id}/analyze/async`);
    return response.data;
  },

  // Toggle public sharing
  toggleShare: async (id: string, isPublic: boolean): Promise<Case> => {
    const response = await api.post(`/cases/${id}/share`, { is_public: isPublic });
    return response.data;
  },

  // Get public case by slug (no auth required)
  getPublic: async (slug: string): Promise<Case> => {
    const response = await api.get(`/cases/public/${slug}`);
    return response.data;
  },

  // Get public case messages (no auth required)
  getPublicMessages: async (slug: string): Promise<Message[]> => {
    const response = await api.get(`/cases/public/${slug}/messages`);
    return response.data;
  },

  // Get public case outputs (no auth required)
  getPublicOutputs: async (slug: string): Promise<Output[]> => {
    const response = await api.get(`/cases/public/${slug}/outputs`);
    return response.data;
  },
};

// Outputs API
export const outputsApi = {
  get: async (id: string): Promise<Output> => {
    const response = await api.get(`/outputs/${id}`);
    return response.data;
  },

  listByCaseId: async (caseId: string): Promise<Output[]> => {
    const response = await api.get(`/cases/${caseId}/outputs`);
    return response.data;
  },

  scholarReview: async (id: string, reviewData: ScholarReviewRequest): Promise<Output> => {
    const response = await api.post(`/outputs/${id}/scholar-review`, reviewData);
    return response.data;
  },

  submitFeedback: async (outputId: string, data: FeedbackCreate): Promise<Feedback> => {
    const response = await api.post(`/outputs/${outputId}/feedback`, data);
    return response.data;
  },
};

// Verses API
export const versesApi = {
  search: async (query: string): Promise<Verse[]> => {
    const response = await api.get(`/verses`, { params: { q: query } });
    return response.data;
  },

  list: async (skip = 0, limit = 100, chapter?: number, featured?: boolean): Promise<Verse[]> => {
    const params: Record<string, number | boolean> = { skip, limit };
    if (chapter) params.chapter = chapter;
    if (featured !== undefined) params.featured = featured;
    const response = await api.get(`/verses`, { params });
    return response.data;
  },

  count: async (chapter?: number, featured?: boolean): Promise<number> => {
    const params: Record<string, number | boolean> = {};
    if (chapter) params.chapter = chapter;
    if (featured !== undefined) params.featured = featured;
    const response = await api.get(`/verses/count`, { params });
    return response.data.count;
  },

  getDaily: async (): Promise<Verse> => {
    const response = await api.get(`/verses/daily`);
    return response.data;
  },

  getRandom: async (): Promise<Verse> => {
    const response = await api.get(`/verses/random`);
    return response.data;
  },

  get: async (canonicalId: string): Promise<Verse> => {
    const response = await api.get(`/verses/${canonicalId}`);
    return response.data;
  },

  getTranslations: async (canonicalId: string): Promise<Translation[]> => {
    const response = await api.get(`/verses/${canonicalId}/translations`);
    return response.data;
  },
};
