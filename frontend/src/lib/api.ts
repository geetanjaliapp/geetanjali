import axios from "axios";
import type {
  Case,
  Output,
  Verse,
  Translation,
  HealthResponse,
  ScholarReviewRequest,
  Feedback,
  FeedbackCreate,
  Message,
  BookMetadata,
  ChapterMetadata,
  SearchResponse,
} from "../types";
import { tokenStorage, authApi } from "../api/auth";
import { getSessionId } from "./session";
import { API_BASE_URL, API_V1_PREFIX } from "./config";

export const api = axios.create({
  baseURL: `${API_BASE_URL}${API_V1_PREFIX}`,
  headers: {
    "Content-Type": "application/json",
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
    const isAuthEndpoint = config.url?.includes("/auth/");

    // Proactive token refresh: check if token needs refresh before request
    if (
      !isAuthEndpoint &&
      tokenStorage.getToken() &&
      tokenStorage.needsRefresh()
    ) {
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
    config.headers["X-Session-ID"] = sessionId;

    // Attach CSRF token for state-changing requests
    const method = config.method?.toLowerCase();
    if (method && ["post", "put", "patch", "delete"].includes(method)) {
      const csrfToken = getCsrfToken();
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }

    return config;
  },
  (error) => Promise.reject(error),
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
  },
);

// Health check endpoint
export const checkHealth = async (): Promise<HealthResponse> => {
  const response = await axios.get(`${API_BASE_URL}/health`);
  return response.data;
};

// Cases API
export const casesApi = {
  create: async (caseData: Omit<Case, "id" | "created_at">): Promise<Case> => {
    const response = await api.post("/cases", caseData);
    return response.data;
  },

  get: async (id: string): Promise<Case> => {
    const response = await api.get(`/cases/${id}`);
    return response.data;
  },

  list: async (skip = 0, limit = 100): Promise<Case[]> => {
    const response = await api.get("/cases", { params: { skip, limit } });
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

  // Toggle public sharing with optional share mode
  toggleShare: async (
    id: string,
    isPublic: boolean,
    shareMode: "full" | "essential" = "full",
  ): Promise<Case> => {
    const response = await api.post(`/cases/${id}/share`, {
      is_public: isPublic,
      share_mode: shareMode,
    });
    return response.data;
  },

  // Get public case by slug (no auth required)
  getPublic: async (slug: string): Promise<Case> => {
    const response = await api.get(`/cases/public/${slug}`);
    return response.data;
  },

  // Record a view for a public case
  recordPublicView: async (slug: string): Promise<{ view_count: number }> => {
    const response = await api.post(`/cases/public/${slug}/view`);
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

  // Soft delete a case
  delete: async (id: string): Promise<void> => {
    await api.delete(`/cases/${id}`);
  },

  // Retry analysis for a failed case
  retry: async (id: string): Promise<Case> => {
    const response = await api.post(`/cases/${id}/retry`);
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

  scholarReview: async (
    id: string,
    reviewData: ScholarReviewRequest,
  ): Promise<Output> => {
    const response = await api.post(
      `/outputs/${id}/scholar-review`,
      reviewData,
    );
    return response.data;
  },

  submitFeedback: async (
    outputId: string,
    data: FeedbackCreate,
  ): Promise<Feedback> => {
    const response = await api.post(`/outputs/${outputId}/feedback`, data);
    return response.data;
  },

  deleteFeedback: async (outputId: string): Promise<void> => {
    await api.delete(`/outputs/${outputId}/feedback`);
  },
};

// Verses API
export const versesApi = {
  search: async (query: string): Promise<Verse[]> => {
    const response = await api.get(`/verses`, { params: { q: query } });
    return response.data;
  },

  list: async (
    skip = 0,
    limit = 100,
    chapter?: number,
    featured?: boolean,
    principles?: string,
  ): Promise<Verse[]> => {
    const params: Record<string, number | boolean | string> = { skip, limit };
    if (chapter) params.chapter = chapter;
    if (featured !== undefined) params.featured = featured;
    if (principles) params.principles = principles;
    const response = await api.get(`/verses`, { params });
    return response.data;
  },

  count: async (
    chapter?: number,
    featured?: boolean,
    principles?: string,
  ): Promise<number> => {
    const params: Record<string, number | boolean | string> = {};
    if (chapter) params.chapter = chapter;
    if (featured !== undefined) params.featured = featured;
    if (principles) params.principles = principles;
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

// Reading Mode Metadata API
export const readingApi = {
  /** Get book metadata for cover page */
  getBookMetadata: async (): Promise<BookMetadata> => {
    const response = await api.get(`/reading/book`);
    return response.data;
  },

  /** Get all chapter metadata */
  getAllChapters: async (): Promise<ChapterMetadata[]> => {
    const response = await api.get(`/reading/chapters`);
    return response.data;
  },

  /** Get metadata for a specific chapter */
  getChapter: async (chapterNumber: number): Promise<ChapterMetadata> => {
    const response = await api.get(`/reading/chapters/${chapterNumber}`);
    return response.data;
  },
};

// Search API
export const searchApi = {
  /**
   * Unified hybrid search across verses
   * Auto-detects query intent (canonical, Sanskrit, keyword, semantic)
   */
  search: async (
    query: string,
    options?: {
      chapter?: number;
      principle?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<SearchResponse> => {
    const params: Record<string, string | number> = { q: query };
    if (options?.chapter) params.chapter = options.chapter;
    if (options?.principle) params.principle = options.principle;
    if (options?.limit) params.limit = options.limit;
    if (options?.offset) params.offset = options.offset;

    const response = await api.get(`/search`, { params });
    return response.data;
  },

  /** Get available consulting principles for filtering */
  getPrinciples: async (): Promise<string[]> => {
    const response = await api.get(`/search/principles`);
    return response.data;
  },
};

// Taxonomy API - Single source of truth for principles and goals
export const taxonomyApi = {
  /** Get all principles with full metadata */
  getPrinciples: async (): Promise<{
    principles: Principle[];
    groups: PrincipleGroup[];
    count: number;
  }> => {
    const response = await api.get(`/taxonomy/principles`);
    return response.data;
  },

  /** Get a single principle by ID */
  getPrinciple: async (principleId: string): Promise<Principle> => {
    const response = await api.get(`/taxonomy/principles/${principleId}`);
    return response.data;
  },

  /** Get all learning goals with principle mappings */
  getGoals: async (): Promise<{
    goals: Goal[];
    count: number;
  }> => {
    const response = await api.get(`/taxonomy/goals`);
    return response.data;
  },

  /** Get a single goal by ID */
  getGoal: async (goalId: string): Promise<Goal> => {
    const response = await api.get(`/taxonomy/goals/${goalId}`);
    return response.data;
  },

  /** Get all principle groups (yoga paths) */
  getGroups: async (): Promise<PrincipleGroup[]> => {
    const response = await api.get(`/taxonomy/groups`);
    return response.data;
  },
};

// Taxonomy Types
export interface Principle {
  id: string;
  label: string;
  shortLabel: string;
  sanskrit: string;
  transliteration: string;
  description: string;
  leadershipContext: string;
  keywords: string[];
  group: string;
  chapterFocus: number[];
}

export interface PrincipleGroup {
  id: string;
  label: string;
  sanskrit: string;
  transliteration: string;
  description: string;
  principles: string[];
}

export interface Goal {
  id: string;
  label: string;
  description: string;
  icon: string;
  principles: string[];
}
