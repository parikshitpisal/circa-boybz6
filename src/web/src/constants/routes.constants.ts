/**
 * @fileoverview Route path constants for the AI-Driven Application Intake Platform
 * Centralizes all route definitions for consistent navigation and access control
 */

/**
 * Public routes accessible without authentication
 */
export const PUBLIC_ROUTES = {
  LOGIN: '/login',
  MFA: '/mfa',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password/:token',
  VERIFY_EMAIL: '/verify-email/:token'
} as const;

/**
 * Protected routes requiring authentication and role-based access
 */
export const PRIVATE_ROUTES = {
  DASHBOARD: '/dashboard',
  APPLICATIONS: {
    LIST: '/applications',
    DETAIL: '/applications/:id',
    NEW: '/applications/new',
    EDIT: '/applications/:id/edit',
    REVIEW: '/applications/:id/review',
    BATCH_UPLOAD: '/applications/batch-upload'
  },
  DOCUMENTS: {
    LIST: '/documents',
    DETAIL: '/documents/:id',
    VIEWER: '/documents/:id/view',
    PROCESSING: '/documents/:id/processing',
    VALIDATION: '/documents/:id/validation'
  },
  SETTINGS: {
    PROFILE: '/settings/profile',
    SECURITY: {
      MAIN: '/settings/security',
      MFA: '/settings/security/mfa',
      API_KEYS: '/settings/security/api-keys',
      AUDIT_LOG: '/settings/security/audit-log'
    },
    WEBHOOKS: {
      LIST: '/settings/webhooks',
      NEW: '/settings/webhooks/new',
      EDIT: '/settings/webhooks/:id',
      LOGS: '/settings/webhooks/:id/logs'
    },
    TEAM: {
      LIST: '/settings/team',
      ROLES: '/settings/team/roles',
      PERMISSIONS: '/settings/team/permissions'
    }
  },
  REPORTS: {
    DASHBOARD: '/reports',
    PROCESSING: '/reports/processing',
    ACCURACY: '/reports/accuracy',
    AUDIT: '/reports/audit'
  }
} as const;

/**
 * Error and system status routes
 */
export const ERROR_ROUTES = {
  NOT_FOUND: '/404',
  SERVER_ERROR: '/500',
  FORBIDDEN: '/403',
  MAINTENANCE: '/maintenance',
  RATE_LIMITED: '/429'
} as const;

/**
 * API endpoint routes for backend communication
 */
export const API_ROUTES = {
  BASE: '/api/v1',
  AUTH: {
    LOGIN: '/auth/login',
    MFA: {
      VERIFY: '/auth/mfa/verify',
      SETUP: '/auth/mfa/setup',
      DISABLE: '/auth/mfa/disable'
    },
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    VERIFY_EMAIL: '/auth/verify-email'
  },
  APPLICATIONS: {
    BASE: '/applications',
    DETAIL: '/applications/:id',
    DOCUMENTS: '/applications/:id/documents',
    STATUS: '/applications/:id/status',
    BATCH: '/applications/batch'
  },
  DOCUMENTS: {
    BASE: '/documents',
    DETAIL: '/documents/:id',
    PROCESS: '/documents/:id/process',
    VALIDATE: '/documents/:id/validate',
    OCR: '/documents/:id/ocr',
    DOWNLOAD: '/documents/:id/download'
  },
  WEBHOOKS: {
    BASE: '/webhooks',
    DETAIL: '/webhooks/:id',
    TEST: '/webhooks/:id/test',
    LOGS: '/webhooks/:id/logs',
    EVENTS: '/webhooks/events'
  },
  USERS: {
    BASE: '/users',
    DETAIL: '/users/:id',
    ROLES: '/users/roles',
    PERMISSIONS: '/users/permissions'
  },
  REPORTS: {
    BASE: '/reports',
    PROCESSING: '/reports/processing',
    ACCURACY: '/reports/accuracy',
    AUDIT: '/reports/audit'
  }
} as const;