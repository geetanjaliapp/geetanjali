import { describe, it, expect, beforeEach, vi } from "vitest";
import { tokenStorage } from "./auth";

/**
 * Tests for token storage and JWT handling.
 * These test security-critical token management logic.
 */
describe("tokenStorage", () => {
  beforeEach(() => {
    // Clear token state before each test
    tokenStorage.clearToken();
  });

  describe("getToken / setToken", () => {
    it("should return null when no token is set", () => {
      expect(tokenStorage.getToken()).toBeNull();
    });

    it("should return the token after setting it", () => {
      // Create a valid JWT structure (header.payload.signature)
      const mockToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      tokenStorage.setToken(mockToken);
      expect(tokenStorage.getToken()).toBe(mockToken);
    });

    it("should handle null token (logout)", () => {
      const mockToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      tokenStorage.setToken(mockToken);
      tokenStorage.setToken(null);
      expect(tokenStorage.getToken()).toBeNull();
    });
  });

  describe("clearToken", () => {
    it("should clear the stored token", () => {
      const mockToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      tokenStorage.setToken(mockToken);
      tokenStorage.clearToken();
      expect(tokenStorage.getToken()).toBeNull();
    });

    it("should reset expiry tracking", () => {
      const mockToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      tokenStorage.setToken(mockToken);
      tokenStorage.clearToken();
      // After clearing, isExpired should return true (no token)
      expect(tokenStorage.isExpired()).toBe(true);
    });
  });

  describe("needsRefresh", () => {
    it("should return false when no token is set", () => {
      expect(tokenStorage.needsRefresh()).toBe(false);
    });

    it("should return false for fresh token (>5 min until expiry)", () => {
      // Token expires in 1 hour
      const mockToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      tokenStorage.setToken(mockToken);
      expect(tokenStorage.needsRefresh()).toBe(false);
    });

    it("should return true when token expires in <5 minutes", () => {
      // Token expires in 3 minutes (180 seconds)
      const mockToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 180 });
      tokenStorage.setToken(mockToken);
      expect(tokenStorage.needsRefresh()).toBe(true);
    });

    it("should return true when token is already expired", () => {
      // Token expired 1 minute ago
      const mockToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) - 60 });
      tokenStorage.setToken(mockToken);
      expect(tokenStorage.needsRefresh()).toBe(true);
    });
  });

  describe("isExpired", () => {
    it("should return true when no token is set", () => {
      expect(tokenStorage.isExpired()).toBe(true);
    });

    it("should return false for valid token", () => {
      // Token expires in 1 hour
      const mockToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) + 3600 });
      tokenStorage.setToken(mockToken);
      expect(tokenStorage.isExpired()).toBe(false);
    });

    it("should return true for expired token", () => {
      // Token expired 1 minute ago
      const mockToken = createMockJWT({ exp: Math.floor(Date.now() / 1000) - 60 });
      tokenStorage.setToken(mockToken);
      expect(tokenStorage.isExpired()).toBe(true);
    });
  });

  describe("JWT parsing edge cases", () => {
    it("should handle malformed JWT gracefully", () => {
      // Set a malformed token - should use default expiry
      tokenStorage.setToken("not-a-valid-jwt");
      // Should not throw, and token should be stored
      expect(tokenStorage.getToken()).toBe("not-a-valid-jwt");
      // With default 1 hour expiry, should not need refresh
      expect(tokenStorage.needsRefresh()).toBe(false);
    });

    it("should handle JWT with invalid base64 payload", () => {
      // Invalid base64 in middle section
      tokenStorage.setToken("header.!!!invalid!!!.signature");
      expect(tokenStorage.getToken()).toBe("header.!!!invalid!!!.signature");
    });
  });
});

/**
 * Helper to create mock JWT tokens for testing.
 * Creates a valid JWT structure with custom payload.
 */
function createMockJWT(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payloadStr = btoa(JSON.stringify(payload));
  const signature = "mock-signature";
  return `${header}.${payloadStr}.${signature}`;
}
