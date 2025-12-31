import { describe, it, expect } from "vitest";
import { getErrorMessage, errorMessages } from "./errorMessages";
import { AxiosError } from "axios";

// Helper to create mock Axios errors
function createAxiosError(
  status: number,
  data?: { detail?: string | Array<{ msg: string }> },
): AxiosError {
  const error = new Error("Request failed") as AxiosError;
  error.isAxiosError = true;
  error.response = {
    status,
    statusText: "Error",
    data: data || {},
    headers: {},
    config: {} as never,
  };
  error.config = {} as never;
  return error;
}

function createNetworkError(code?: string): AxiosError {
  const error = new Error("Network Error") as AxiosError;
  error.isAxiosError = true;
  error.code = code;
  error.config = {} as never;
  // No response for network errors
  return error;
}

describe("getErrorMessage", () => {
  describe("null/undefined errors", () => {
    it("should return default message for null error", () => {
      expect(getErrorMessage(null)).toBe(
        "Something went wrong. Please try again.",
      );
    });

    it("should return default message for undefined error", () => {
      expect(getErrorMessage(undefined)).toBe(
        "Something went wrong. Please try again.",
      );
    });

    it("should return context-specific default for null error", () => {
      expect(getErrorMessage(null, "login")).toBe(
        "Unable to sign in. Please try again.",
      );
    });
  });

  describe("HTTP status codes", () => {
    it("should handle 400 Bad Request", () => {
      const error = createAxiosError(400);
      expect(getErrorMessage(error, "login")).toBe(
        "Please check your email and password format.",
      );
      expect(getErrorMessage(error, "signup")).toBe(
        "Please check your information and try again.",
      );
    });

    it("should handle 401 Unauthorized", () => {
      const error = createAxiosError(401);
      expect(getErrorMessage(error, "login")).toBe(
        "Invalid email or password. Please try again.",
      );
      expect(getErrorMessage(error, "general")).toBe(
        "Please sign in to continue.",
      );
    });

    it("should handle 403 Forbidden", () => {
      const error = createAxiosError(403);
      expect(getErrorMessage(error, "case_load")).toBe(
        "You do not have permission to view this consultation.",
      );
    });

    it("should handle 404 Not Found", () => {
      const error = createAxiosError(404);
      expect(getErrorMessage(error, "case_load")).toBe(
        "Consultation not found.",
      );
      expect(getErrorMessage(error, "verse_load")).toBe("Verse not found.");
    });

    it("should handle 409 Conflict", () => {
      const error = createAxiosError(409);
      // Vague message - doesn't confirm email exists (prevents account enumeration)
      expect(getErrorMessage(error, "signup")).toBe(
        "Unable to create account. If you already have an account, try signing in or resetting your password.",
      );
    });

    it("should handle 422 Validation Error", () => {
      const error = createAxiosError(422);
      expect(getErrorMessage(error, "signup")).toBe(
        "Please check your information. Make sure your password meets the requirements.",
      );
    });

    it("should handle 429 Rate Limit", () => {
      const error = createAxiosError(429);
      expect(getErrorMessage(error, "case_analyze")).toBe(
        "Analysis rate limit reached. Please wait a moment.",
      );
    });

    it("should handle 500 Internal Server Error", () => {
      const error = createAxiosError(500);
      expect(getErrorMessage(error, "case_analyze")).toBe(
        "Analysis temporarily unavailable. Please try again later.",
      );
    });

    it("should handle 502 and 503 as server unavailable", () => {
      const error502 = createAxiosError(502);
      const error503 = createAxiosError(503);
      expect(getErrorMessage(error502)).toBe(
        "Our servers are temporarily unavailable. Please try again later.",
      );
      expect(getErrorMessage(error503)).toBe(
        "Our servers are temporarily unavailable. Please try again later.",
      );
    });
  });

  describe("backend detail messages", () => {
    it("should use friendly backend message directly", () => {
      const error = createAxiosError(400, {
        detail: "Please provide a valid email address.",
      });
      expect(getErrorMessage(error)).toBe(
        "Please provide a valid email address.",
      );
    });

    it("should not use technical backend messages", () => {
      const error = createAxiosError(500, {
        detail: "LLM unavailable: Anthropic API rate limit exceeded",
      });
      // Should use HTTP status message, not the technical detail
      expect(getErrorMessage(error)).toBe(
        "Something went wrong. Please try again later.",
      );
    });

    it("should handle validation error arrays", () => {
      const error = createAxiosError(422, {
        detail: [{ msg: "Password must be at least 8 characters" }],
      });
      expect(getErrorMessage(error)).toBe(
        "Password must be at least 8 characters",
      );
    });
  });

  describe("network errors", () => {
    it("should handle timeout errors", () => {
      const error = createNetworkError("ECONNABORTED");
      expect(getErrorMessage(error)).toBe(
        "The request took too long. Please try again.",
      );
    });

    it("should handle connection refused", () => {
      const error = createNetworkError();
      expect(getErrorMessage(error)).toBe(
        "Unable to connect. Please check your internet connection.",
      );
    });
  });

  describe("standard Error objects", () => {
    it("should use friendly error message", () => {
      const error = new Error("Your session has expired");
      expect(getErrorMessage(error)).toBe("Your session has expired");
    });

    it("should not use technical error messages", () => {
      const error = new Error("Network Error");
      expect(getErrorMessage(error)).toBe(
        "Something went wrong. Please try again.",
      );
    });
  });

  describe("string errors", () => {
    it("should use friendly string errors", () => {
      expect(getErrorMessage("Please try again later")).toBe(
        "Please try again later",
      );
    });

    it("should not use technical string errors", () => {
      expect(getErrorMessage("ERR_NETWORK")).toBe(
        "Something went wrong. Please try again.",
      );
    });
  });
});

describe("errorMessages convenience functions", () => {
  it("should provide context-specific error messages", () => {
    const error = createAxiosError(401);
    expect(errorMessages.login(error)).toBe(
      "Invalid email or password. Please try again.",
    );
    expect(errorMessages.signup(error)).toBe("Please sign in to continue.");
    expect(errorMessages.caseLoad(error)).toBe(
      "Please sign in to view this consultation.",
    );
  });

  it("should handle logout context", () => {
    const error = createAxiosError(500);
    expect(errorMessages.logout(error)).toBe(
      "Something went wrong. You have been signed out locally.",
    );
  });

  it("should handle search context", () => {
    const error = createAxiosError(404);
    expect(errorMessages.search(error)).toBe("No results found.");
  });

  it("should handle case analysis context", () => {
    const error = createAxiosError(409);
    expect(errorMessages.caseAnalyze(error)).toBe(
      "Analysis already in progress.",
    );
  });

  it("should handle contact context", () => {
    const error429 = createAxiosError(429);
    expect(errorMessages.contact(error429)).toBe(
      "Too many messages sent. Please try again in an hour.",
    );

    const error422 = createAxiosError(422);
    expect(errorMessages.contact(error422)).toBe(
      "Please check your message content and try again.",
    );

    const error500 = createAxiosError(500);
    expect(errorMessages.contact(error500)).toBe(
      "Unable to send your message. Please try again later.",
    );
  });

  it("should handle health context", () => {
    const error500 = createAxiosError(500);
    expect(errorMessages.health(error500)).toBe(
      "Our servers are temporarily unavailable. Please try again later.",
    );
  });
});

describe("technical message detection", () => {
  const technicalMessages = [
    "Request failed with status code 500",
    "Network Error",
    "timeout of 30000ms exceeded",
    "ECONNREFUSED",
    "ERR_NETWORK",
    "Internal Server Error",
    "LLM unavailable: connection refused",
    "Anthropic API error",
    "Ollama timeout",
    "database error: connection lost",
  ];

  it.each(technicalMessages)('should detect "%s" as technical', (message) => {
    expect(getErrorMessage(new Error(message))).toBe(
      "Something went wrong. Please try again.",
    );
  });

  const friendlyMessages = [
    "Please provide a valid email address",
    "Your account has been suspended",
    "This feature is not available",
    "Please wait a moment before trying again",
  ];

  it.each(friendlyMessages)(
    'should pass through "%s" as friendly',
    (message) => {
      expect(getErrorMessage(new Error(message))).toBe(message);
    },
  );
});
