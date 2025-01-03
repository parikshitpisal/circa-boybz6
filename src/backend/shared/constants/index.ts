/**
 * Centralized constants file for backend services
 * Contains shared enums, configuration values and constants used across:
 * - API Gateway
 * - Document Processor
 * - Email Service
 */

/**
 * Standard HTTP status codes for API responses
 */
export enum HTTP_STATUS {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500
}

/**
 * Application processing status enums for tracking document lifecycle
 */
export enum APPLICATION_STATUS {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED'
}

/**
 * Supported document types for application processing
 */
export enum DOCUMENT_TYPES {
  BANK_STATEMENT = 'BANK_STATEMENT',
  ISO_APPLICATION = 'ISO_APPLICATION',
  VOIDED_CHECK = 'VOIDED_CHECK'
}

/**
 * API rate limiting configuration for different service tiers
 */
export const API_RATE_LIMITS = {
  STANDARD_TIER: {
    hourlyLimit: 1000,
    burstLimit: 100,
    windowSeconds: 3600,
    retryAfterSeconds: 300
  },
  PREMIUM_TIER: {
    hourlyLimit: 5000,
    burstLimit: 500,
    windowSeconds: 3600,
    retryAfterSeconds: 60
  },
  INTERNAL_TIER: {
    hourlyLimit: 'unlimited',
    burstLimit: 1000,
    windowSeconds: 60,
    retryAfterSeconds: 1
  }
} as const;

/**
 * Security configuration constants for authentication and encryption
 */
export const SECURITY_CONFIG = {
  // JWT token expiry in seconds (1 hour)
  TOKEN_EXPIRY: 3600,
  // Refresh token expiry in seconds (24 hours)
  REFRESH_TOKEN_EXPIRY: 86400,
  // Encryption algorithm for sensitive data
  ENCRYPTION_ALGORITHM: 'AES-256-GCM',
  // Encryption key length in bits
  KEY_LENGTH: 256,
  // Number of salt rounds for password hashing
  SALT_ROUNDS: 12,
  // Maximum failed login attempts before account lockout
  MAX_LOGIN_ATTEMPTS: 5
} as const;

/**
 * Global pagination defaults
 */
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_SORT_ORDER = 'desc';

/**
 * Security and validation constants
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * File processing limits
 */
export const MAX_FILE_SIZE_MB = 25;
export const MAX_BATCH_SIZE = 50;