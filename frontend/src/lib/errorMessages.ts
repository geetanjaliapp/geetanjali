/**
 * Centralized error message utility
 *
 * Converts technical API errors into human-friendly messages
 */

import { AxiosError } from 'axios';

// Context-specific error messages
type ErrorContext =
  | 'login'
  | 'signup'
  | 'logout'
  | 'refresh'
  | 'case_create'
  | 'case_load'
  | 'case_analyze'
  | 'verse_load'
  | 'search'
  | 'general';

// Shared messages for common patterns
const SHARED = {
  serverUnavailable: 'Our servers are temporarily unavailable. Please try again later.',
  somethingWrong: 'Something went wrong. Please try again later.',
  checkConnection: 'Unable to connect. Please check your internet connection.',
  tooManyRequests: 'Too many requests. Please wait a moment and try again.',
  requestTooLong: 'The request took too long. Please try again.',
  sessionExpired: 'Your session has expired. Please sign in again.',
  noPermission: 'You do not have permission to perform this action.',
};

// HTTP status code to friendly message mapping
const HTTP_STATUS_MESSAGES: Record<number, Partial<Record<ErrorContext, string>>> = {
  400: {
    login: 'Please check your email and password format.',
    signup: 'Please check your information and try again.',
    case_create: 'Please check your input and try again.',
    search: 'Please try a different search term.',
    general: 'Please check your input and try again.',
  },
  401: {
    login: 'Invalid email or password. Please try again.',
    refresh: SHARED.sessionExpired,
    case_create: 'Please sign in to submit a consultation.',
    case_load: 'Please sign in to view this consultation.',
    general: 'Please sign in to continue.',
  },
  403: {
    login: 'Access denied. Please contact support if this continues.',
    signup: 'Account creation is currently unavailable.',
    case_load: 'You do not have permission to view this consultation.',
    general: SHARED.noPermission,
  },
  404: {
    login: 'Account not found. Please check your email or sign up.',
    case_load: 'Consultation not found.',
    case_analyze: 'Case not found.',
    verse_load: 'Verse not found.',
    search: 'No results found.',
    general: 'The requested item was not found.',
  },
  409: {
    signup: 'An account with this email already exists. Please sign in instead.',
    case_analyze: 'Analysis already in progress.',
    general: 'A conflict occurred. Please try again.',
  },
  422: {
    login: 'Invalid email or password format.',
    signup: 'Please check your information. Make sure your password meets the requirements.',
    case_create: 'Please provide more details in your question.',
    general: 'Please check your input and try again.',
  },
  429: {
    login: SHARED.tooManyRequests,
    case_create: 'You have submitted too many consultations. Please wait a moment.',
    case_analyze: 'Analysis rate limit reached. Please wait a moment.',
    general: SHARED.tooManyRequests,
  },
  500: {
    logout: 'Something went wrong. You have been signed out locally.',
    case_create: 'Unable to submit your question right now. Please try again later.',
    case_analyze: 'Analysis temporarily unavailable. Please try again later.',
    general: SHARED.somethingWrong,
  },
  // 502 and 503 share the same message
  502: { general: SHARED.serverUnavailable },
  503: { general: SHARED.serverUnavailable },
};

// Default fallback messages per context
const DEFAULT_ERROR_MESSAGES: Record<ErrorContext, string> = {
  login: 'Unable to sign in. Please try again.',
  signup: 'Unable to create account. Please try again.',
  logout: 'Unable to sign out. Please try again.',
  refresh: 'Session error. Please sign in again.',
  case_create: 'Unable to submit your question. Please try again.',
  case_load: 'Unable to load consultation. Please try again.',
  case_analyze: 'Unable to analyze case. Please try again.',
  verse_load: 'Unable to load verse. Please try again.',
  search: 'Search failed. Please try again.',
  general: 'Something went wrong. Please try again.',
};

/**
 * Patterns to detect if a message is already user-friendly
 */
function isAlreadyFriendly(message: string): boolean {
  const technicalPatterns = [
    /^Request failed with status code \d+$/i,
    /^Network Error$/i,
    /^timeout of \d+ms exceeded$/i,
    /^E(CONN|NOT|TIME)/i,
    /^ERR_/i,
    /^[A-Z_]+_ERROR$/,
    /^\d{3}$/,
    /^(Internal Server Error|Bad Request|Unauthorized|Forbidden|Not Found|Service Unavailable)$/i,
    // Technical LLM/backend errors
    /(LLM unavailable|Anthropic|Ollama|OpenAI|API key|rate limit|token limit|context length|JSON parse|database error|connection refused|pipeline failed)/i,
  ];

  return !technicalPatterns.some(pattern => pattern.test(message.trim()));
}

/**
 * Get message for HTTP status code and context
 */
function getStatusMessage(status: number, context: ErrorContext): string {
  // Try exact context match
  const statusMessages = HTTP_STATUS_MESSAGES[status];
  if (statusMessages) {
    if (statusMessages[context]) {
      return statusMessages[context];
    }
    // Fall back to general for this status
    if (statusMessages.general) {
      return statusMessages.general;
    }
  }

  // Generic server/client error fallback
  if (status >= 500) {
    return HTTP_STATUS_MESSAGES[500]?.general || SHARED.somethingWrong;
  }

  return DEFAULT_ERROR_MESSAGES[context];
}

/**
 * Type guard for Axios errors
 */
function isAxiosError(error: unknown): error is AxiosError<{ detail?: string | Array<{ msg: string }> }> {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  );
}

/**
 * Get a user-friendly error message from any error
 */
export function getErrorMessage(error: unknown, context: ErrorContext = 'general'): string {
  if (!error) {
    return DEFAULT_ERROR_MESSAGES[context];
  }

  if (isAxiosError(error)) {
    // Check for backend-provided detail message first
    const backendMessage = error.response?.data?.detail;
    if (backendMessage && typeof backendMessage === 'string' && isAlreadyFriendly(backendMessage)) {
      return backendMessage;
    }

    // Handle validation errors (array of details)
    if (Array.isArray(error.response?.data?.detail)) {
      const validationErrors = error.response?.data?.detail;
      if (validationErrors.length > 0 && validationErrors[0].msg) {
        return validationErrors[0].msg;
      }
    }

    // Network error (no response received)
    if (!error.response) {
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        return SHARED.requestTooLong;
      }
      return SHARED.checkConnection;
    }

    return getStatusMessage(error.response.status, context);
  }

  // Handle standard Error objects
  if (error instanceof Error && isAlreadyFriendly(error.message)) {
    return error.message;
  }

  // Handle string errors
  if (typeof error === 'string' && isAlreadyFriendly(error)) {
    return error;
  }

  return DEFAULT_ERROR_MESSAGES[context];
}

/**
 * Convenience functions for specific contexts
 */
export const errorMessages = {
  login: (error: unknown) => getErrorMessage(error, 'login'),
  signup: (error: unknown) => getErrorMessage(error, 'signup'),
  logout: (error: unknown) => getErrorMessage(error, 'logout'),
  caseCreate: (error: unknown) => getErrorMessage(error, 'case_create'),
  caseLoad: (error: unknown) => getErrorMessage(error, 'case_load'),
  caseAnalyze: (error: unknown) => getErrorMessage(error, 'case_analyze'),
  verseLoad: (error: unknown) => getErrorMessage(error, 'verse_load'),
  search: (error: unknown) => getErrorMessage(error, 'search'),
  general: (error: unknown) => getErrorMessage(error, 'general'),
};

export default errorMessages;
