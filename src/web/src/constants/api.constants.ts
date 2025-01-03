/**
 * API Constants
 * Centralized TypeScript constants for frontend-backend communication
 * @version 1.0.0
 */

/**
 * API version for all endpoints
 * @constant
 */
export const API_VERSION = 'v1';

/**
 * Base API path including version
 * @constant
 */
export const API_BASE_PATH = `/api/${API_VERSION}`;

/**
 * Strongly-typed API endpoint constants
 * Used for making HTTP requests to backend services
 * @enum {string}
 */
export const enum API_ENDPOINTS {
  /** Application management endpoints */
  APPLICATIONS = '/api/v1/applications',
  
  /** Document processing endpoints */
  DOCUMENTS = '/api/v1/documents',
  
  /** Webhook configuration endpoints */
  WEBHOOKS = '/api/v1/webhooks',
  
  /** Authentication endpoints */
  AUTH = '/api/v1/auth',
  
  /** System settings endpoints */
  SETTINGS = '/api/v1/settings'
}

/**
 * HTTP Status codes used in API responses
 * Based on standard HTTP status codes
 * @enum {number}
 */
export const enum HTTP_STATUS {
  /** Successful response */
  OK = 200,
  
  /** Resource created successfully */
  CREATED = 201,
  
  /** Invalid request parameters */
  BAD_REQUEST = 400,
  
  /** Authentication required */
  UNAUTHORIZED = 401,
  
  /** Insufficient permissions */
  FORBIDDEN = 403,
  
  /** Resource not found */
  NOT_FOUND = 404,
  
  /** Too many requests / Rate limited */
  RATE_LIMIT = 429,
  
  /** Internal server error */
  SERVER_ERROR = 500
}

/**
 * Application-specific error codes
 * Used for client-side error handling and display
 * @enum {string}
 */
export const enum ERROR_CODES {
  /** Data validation errors */
  VALIDATION_ERROR = 'ERR_VALIDATION',
  
  /** Authentication failures */
  AUTHENTICATION_ERROR = 'ERR_AUTH',
  
  /** Authorization/permission errors */
  AUTHORIZATION_ERROR = 'ERR_FORBIDDEN',
  
  /** Rate limit exceeded errors */
  RATE_LIMIT_ERROR = 'ERR_RATE_LIMIT',
  
  /** Internal server errors */
  SERVER_ERROR = 'ERR_SERVER'
}

/**
 * Type definitions for API response error format
 */
export type APIError = {
  error: string;
  code: ERROR_CODES;
  message: string;
  details?: Record<string, unknown>;
};

/**
 * Type definitions for API response success format
 */
export type APIResponse<T> = {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
};

/**
 * Rate limit response headers
 */
export const enum RATE_LIMIT_HEADERS {
  /** Remaining requests in window */
  REMAINING = 'X-RateLimit-Remaining',
  
  /** Total requests allowed */
  LIMIT = 'X-RateLimit-Limit',
  
  /** Window reset timestamp */
  RESET = 'X-RateLimit-Reset'
}

/**
 * API request timeout in milliseconds
 * @constant
 */
export const API_TIMEOUT = 30000; // 30 seconds

/**
 * Maximum retry attempts for failed requests
 * @constant
 */
export const MAX_RETRIES = 3;

/**
 * Base delay between retries in milliseconds
 * @constant
 */
export const RETRY_DELAY = 1000; // 1 second