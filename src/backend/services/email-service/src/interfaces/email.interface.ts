/**
 * TypeScript interfaces for email service configuration and message handling
 * Implements requirements for automated email monitoring and processing
 * @version 1.0.0
 */

import { BaseDocument } from '../../../shared/interfaces/common';
import { ImapFlow } from 'imapflow'; // v1.0.0
import { Transporter } from 'nodemailer'; // v6.9.0

/**
 * OAuth2 configuration interface for email authentication
 */
export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  accessToken: string;
  expires: number;
}

/**
 * Email authentication configuration interface
 */
export interface EmailAuth {
  user: string;
  pass?: string;
  oauth2?: OAuth2Config;
}

/**
 * Retry configuration for connection handling
 */
export interface RetryConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

/**
 * Email filtering rules configuration
 */
export interface EmailFilterConfig {
  allowedDomains: string[];
  maxAttachmentSize: number;
  maxAttachments: number;
  allowedFileTypes: string[];
}

/**
 * Enhanced email server configuration interface
 */
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: EmailAuth;
  poolSize: number;
  idleTimeout: number;
  retryStrategy: RetryConfig;
  filterConfig: EmailFilterConfig;
}

/**
 * Email attachment interface
 */
export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
  checksum: string;
}

/**
 * Email processing status enum
 */
export enum EmailProcessingStatus {
  PENDING = 'PENDING',
  VALIDATION = 'VALIDATION',
  PROCESSING = 'PROCESSING',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  COMPLETED = 'COMPLETED'
}

/**
 * Validation severity levels
 */
export enum ValidationSeverity {
  ERROR = 'ERROR',
  WARNING = 'WARNING',
  INFO = 'INFO'
}

/**
 * Validation error interface
 */
export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: ValidationSeverity;
}

/**
 * Validation warning interface
 */
export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
}

/**
 * Validation metadata interface
 */
export interface ValidationMetadata {
  validatedAt: Date;
  validatedBy: string;
  validationDuration: number;
}

/**
 * Email validation result interface
 */
export interface EmailValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metadata: ValidationMetadata;
}

/**
 * Processing metrics interface
 */
export interface ProcessingMetrics {
  startTime: Date;
  endTime: Date;
  duration: number;
  attachmentCount: number;
  totalSize: number;
}

/**
 * Processing metadata interface
 */
export interface ProcessingMetadata {
  attempts: number;
  lastAttempt: Date;
  processingNode: string;
  metrics: ProcessingMetrics;
}

/**
 * Enhanced email message interface extending BaseDocument
 */
export interface EmailMessage extends BaseDocument {
  from: string;
  subject: string;
  receivedDate: Date;
  attachments: EmailAttachment[];
  status: EmailProcessingStatus;
  processingMetadata: ProcessingMetadata;
  validationResult?: EmailValidationResult;
}

/**
 * Type guard for EmailMessage validation
 */
export function isEmailMessage(message: unknown): message is EmailMessage {
  if (!message || typeof message !== 'object') {
    return false;
  }

  const msg = message as EmailMessage;

  return (
    typeof msg.id === 'string' &&
    msg.createdAt instanceof Date &&
    msg.updatedAt instanceof Date &&
    typeof msg.from === 'string' &&
    typeof msg.subject === 'string' &&
    msg.receivedDate instanceof Date &&
    Array.isArray(msg.attachments) &&
    Object.values(EmailProcessingStatus).includes(msg.status) &&
    typeof msg.processingMetadata === 'object'
  );
}