/**
 * Application Constants
 * Defines constant values and enums for merchant cash advance application processing
 * @version 1.0.0
 */

/**
 * Enum for application processing status tracking
 */
export enum APPLICATION_STATUS {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REJECTED = 'REJECTED'
}

/**
 * Enum for document classification types
 */
export enum DOCUMENT_TYPE {
  BANK_STATEMENT = 'BANK_STATEMENT',
  ISO_APPLICATION = 'ISO_APPLICATION',
  VOIDED_CHECK = 'VOIDED_CHECK'
}

/**
 * Human-readable labels for application status values
 */
export const APPLICATION_STATUS_LABELS = {
  [APPLICATION_STATUS.PENDING]: 'Pending Review',
  [APPLICATION_STATUS.PROCESSING]: 'Processing',
  [APPLICATION_STATUS.COMPLETED]: 'Completed',
  [APPLICATION_STATUS.FAILED]: 'Processing Failed',
  [APPLICATION_STATUS.REJECTED]: 'Application Rejected'
} as const;

/**
 * Human-readable labels for document types
 */
export const DOCUMENT_TYPE_LABELS = {
  [DOCUMENT_TYPE.BANK_STATEMENT]: 'Bank Statement',
  [DOCUMENT_TYPE.ISO_APPLICATION]: 'ISO Application',
  [DOCUMENT_TYPE.VOIDED_CHECK]: 'Voided Check'
} as const;

/**
 * Queue management and display configuration
 */
export const APPLICATION_QUEUE_CONFIG = {
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
  REFRESH_INTERVAL: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 5000 // 5 seconds
} as const;

/**
 * WCAG 2.1 AA compliant color codes for status indicators
 */
export const STATUS_COLORS = {
  [APPLICATION_STATUS.PENDING]: '#FFA726', // Orange - Pending
  [APPLICATION_STATUS.PROCESSING]: '#2196F3', // Blue - Processing
  [APPLICATION_STATUS.COMPLETED]: '#4CAF50', // Green - Success
  [APPLICATION_STATUS.FAILED]: '#F44336', // Red - Error
  [APPLICATION_STATUS.REJECTED]: '#9E9E9E' // Grey - Rejected
} as const;

/**
 * Business validation rules and thresholds
 */
export const VALIDATION_RULES = {
  MIN_YEARS_IN_BUSINESS: 2,
  MIN_MONTHLY_REVENUE: 10000, // $10,000
  MIN_CREDIT_SCORE: 500,
  MAX_FILE_SIZE: 25, // 25MB
  ALLOWED_FILE_TYPES: ['.pdf', '.jpg', '.jpeg', '.png'] as const
} as const;

/**
 * Error message templates for validation failures
 */
export const ERROR_MESSAGES = {
  INVALID_YEARS: 'Business must be operational for at least {0} years',
  INVALID_REVENUE: 'Monthly revenue must be at least ${0}',
  INVALID_CREDIT: 'Credit score must be at least {0}',
  INVALID_FILE_SIZE: 'File size must not exceed {0}MB',
  INVALID_FILE_TYPE: 'Only {0} file types are allowed'
} as const;