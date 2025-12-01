import axios from 'axios';
import type { Case, Output, Verse, HealthResponse, ScholarReviewRequest } from '../types';
import { tokenStorage } from '../api/auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const API_V1_PREFIX = import.meta.env.VITE_API_V1_PREFIX || '/api/v1';

export const api = axios.create({
  baseURL: `${API_BASE_URL}${API_V1_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach access token
api.interceptors.request.use(
  (config) => {
    const token = tokenStorage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
};

// Verses API
export const versesApi = {
  search: async (query: string): Promise<Verse[]> => {
    const response = await api.get(`/verses`, { params: { q: query } });
    return response.data;
  },

  list: async (skip = 0, limit = 100, chapter?: number): Promise<Verse[]> => {
    const params: any = { skip, limit };
    if (chapter) params.chapter = chapter;
    const response = await api.get(`/verses`, { params });
    return response.data;
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
};
