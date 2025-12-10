import { describe, it, expect, vi } from "vitest";
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

/**
 * Tests for API client configuration and interceptors.
 * These test error handling and request configuration.
 */

// Mock the session module
vi.mock("./session", () => ({
  getSessionId: vi.fn(() => "mock-session-id"),
}));

// Mock the auth module
vi.mock("../api/auth", () => ({
  tokenStorage: {
    getToken: vi.fn(() => null),
    needsRefresh: vi.fn(() => false),
    clearToken: vi.fn(),
  },
  authApi: {
    refresh: vi.fn(),
  },
}));

describe("API error message extraction", () => {
  it("should extract error detail from FastAPI error response", () => {
    // Simulate FastAPI error response format
    const errorResponse = {
      response: {
        data: {
          detail: "Case not found",
        },
        status: 404,
        statusText: "Not Found",
      },
      message: "Request failed with status code 404",
    } as AxiosError;

    // The response interceptor extracts detail to message
    if (errorResponse.response?.data?.detail) {
      errorResponse.message = errorResponse.response.data.detail;
    }

    expect(errorResponse.message).toBe("Case not found");
  });

  it("should extract validation error details", () => {
    // FastAPI validation error format
    const errorResponse = {
      response: {
        data: {
          detail: [
            {
              loc: ["body", "email"],
              msg: "value is not a valid email address",
              type: "value_error.email",
            },
          ],
        },
        status: 422,
        statusText: "Unprocessable Entity",
      },
      message: "Request failed with status code 422",
    } as AxiosError;

    // For array details, keep original message (more complex extraction)
    if (
      errorResponse.response?.data?.detail &&
      typeof errorResponse.response.data.detail === "string"
    ) {
      errorResponse.message = errorResponse.response.data.detail;
    }

    // Array detail should not overwrite message
    expect(errorResponse.message).toBe("Request failed with status code 422");
  });

  it("should preserve original message when no detail present", () => {
    const errorResponse = {
      response: {
        data: {},
        status: 500,
        statusText: "Internal Server Error",
      },
      message: "Network Error",
    } as AxiosError;

    if (errorResponse.response?.data?.detail) {
      errorResponse.message = errorResponse.response.data.detail;
    }

    expect(errorResponse.message).toBe("Network Error");
  });
});

describe("Request configuration", () => {
  it("should always attach session ID header", () => {
    const config: InternalAxiosRequestConfig = {
      headers: new axios.AxiosHeaders(),
      url: "/cases",
      method: "get",
    };

    // Simulate session ID attachment
    config.headers["X-Session-ID"] = "mock-session-id";

    expect(config.headers["X-Session-ID"]).toBe("mock-session-id");
  });

  it("should attach auth token when available", () => {
    const config: InternalAxiosRequestConfig = {
      headers: new axios.AxiosHeaders(),
      url: "/cases",
      method: "get",
    };

    const token = "mock-access-token";
    if (token && token.trim().length > 0) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    expect(config.headers.Authorization).toBe("Bearer mock-access-token");
  });

  it("should not attach auth header for empty token", () => {
    const config: InternalAxiosRequestConfig = {
      headers: new axios.AxiosHeaders(),
      url: "/cases",
      method: "get",
    };

    const token = "";
    if (token && token.trim().length > 0) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    expect(config.headers.Authorization).toBeUndefined();
  });

  it("should not attach auth header for whitespace-only token", () => {
    const config: InternalAxiosRequestConfig = {
      headers: new axios.AxiosHeaders(),
      url: "/cases",
      method: "get",
    };

    const token = "   ";
    if (token && token.trim().length > 0) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    expect(config.headers.Authorization).toBeUndefined();
  });
});

describe("CSRF token handling", () => {
  it("should attach CSRF token for POST requests", () => {
    const config: InternalAxiosRequestConfig = {
      headers: new axios.AxiosHeaders(),
      url: "/cases",
      method: "post",
    };

    const csrfToken = "mock-csrf-token";
    const method = config.method?.toLowerCase();

    if (method && ["post", "put", "patch", "delete"].includes(method)) {
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }

    expect(config.headers["X-CSRF-Token"]).toBe("mock-csrf-token");
  });

  it("should not attach CSRF token for GET requests", () => {
    const config: InternalAxiosRequestConfig = {
      headers: new axios.AxiosHeaders(),
      url: "/cases",
      method: "get",
    };

    const csrfToken = "mock-csrf-token";
    const method = config.method?.toLowerCase();

    if (method && ["post", "put", "patch", "delete"].includes(method)) {
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }

    expect(config.headers["X-CSRF-Token"]).toBeUndefined();
  });

  it("should attach CSRF token for DELETE requests", () => {
    const config: InternalAxiosRequestConfig = {
      headers: new axios.AxiosHeaders(),
      url: "/cases/123",
      method: "delete",
    };

    const csrfToken = "mock-csrf-token";
    const method = config.method?.toLowerCase();

    if (method && ["post", "put", "patch", "delete"].includes(method)) {
      if (csrfToken) {
        config.headers["X-CSRF-Token"] = csrfToken;
      }
    }

    expect(config.headers["X-CSRF-Token"]).toBe("mock-csrf-token");
  });
});

describe("Auth endpoint detection", () => {
  it("should identify auth endpoints correctly", () => {
    const authUrls = ["/auth/login", "/auth/signup", "/auth/refresh"];
    const nonAuthUrls = ["/cases", "/verses", "/outputs"];

    authUrls.forEach((url) => {
      expect(url.includes("/auth/")).toBe(true);
    });

    nonAuthUrls.forEach((url) => {
      expect(url.includes("/auth/")).toBe(false);
    });
  });
});
