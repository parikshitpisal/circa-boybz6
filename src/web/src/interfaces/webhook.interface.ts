/**
 * Webhook interface definitions for the AI-Driven Application Intake Platform
 * Implements webhook integration requirements from Section 3.3.4
 * @version 1.0.0
 */

import { AuthUser } from '../interfaces/auth.interface';

/**
 * Comprehensive enum for all possible webhook event types
 * Covers the entire application lifecycle and processing states
 */
export enum WebhookEvent {
  APPLICATION_CREATED = 'APPLICATION_CREATED',
  APPLICATION_UPDATED = 'APPLICATION_UPDATED',
  APPLICATION_COMPLETED = 'APPLICATION_COMPLETED',
  APPLICATION_REJECTED = 'APPLICATION_REJECTED',
  DOCUMENT_RECEIVED = 'DOCUMENT_RECEIVED',
  DOCUMENT_PROCESSED = 'DOCUMENT_PROCESSED',
  DOCUMENT_FAILED = 'DOCUMENT_FAILED',
  OCR_COMPLETED = 'OCR_COMPLETED',
  DATA_VALIDATED = 'DATA_VALIDATED',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}

/**
 * Webhook endpoint status values
 * Tracks the operational state of webhook endpoints
 */
export enum WebhookStatus {
  ACTIVE = 'ACTIVE',           // Endpoint is functioning normally
  INACTIVE = 'INACTIVE',       // Endpoint is manually disabled
  FAILED = 'FAILED',          // Endpoint has failed delivery attempts
  SUSPENDED = 'SUSPENDED',     // Endpoint is temporarily suspended
  RATE_LIMITED = 'RATE_LIMITED' // Endpoint has exceeded rate limits
}

/**
 * Webhook retry configuration with exponential backoff
 * Implements enterprise-grade delivery reliability
 */
export interface WebhookRetryConfig {
  maxRetries: number;         // Maximum number of retry attempts
  backoffRate: number;        // Exponential backoff multiplier
  initialDelay: number;       // Initial retry delay in milliseconds
  maxDelay: number;          // Maximum retry delay in milliseconds
  enableJitter: boolean;      // Add randomization to retry delays
  timeoutSeconds: number;     // Request timeout in seconds
}

/**
 * Enterprise-grade webhook security configuration
 * Implements security requirements from Section 3.3.4
 */
export interface WebhookSecurityConfig {
  signatureHeader: string;     // Custom signature header name
  signatureVersion: string;    // HMAC signature version
  tlsVersion: string;         // Required TLS version (1.3)
  allowedIpRanges: string[];  // IP whitelist for additional security
  enforceHttps: boolean;      // Require HTTPS endpoints
  encryptionAlgorithm: string; // Payload encryption algorithm
  secretRotationDays: number;  // Secret rotation interval
}

/**
 * Webhook monitoring and audit metadata
 * Tracks webhook performance and reliability metrics
 */
export interface WebhookMetadata {
  description: string;                // Webhook purpose description
  labels: Record<string, string>;     // Custom metadata labels
  createdById: string;               // Creator's user ID
  createdByEmail: string;            // Creator's email
  lastSuccess: Date;                 // Last successful delivery
  lastFailure: Date;                 // Last failed delivery
  failureCount: number;              // Total delivery failures
  averageLatencyMs: number;          // Average delivery latency
  successRate: number;               // Delivery success percentage
  customHeaders: Record<string, unknown>; // Custom HTTP headers
  version: string;                   // Webhook version identifier
}

/**
 * Individual webhook delivery attempt status
 * Tracks detailed delivery metrics and outcomes
 */
export interface WebhookDeliveryStatus {
  deliveryId: string;        // Unique delivery identifier
  event: WebhookEvent;       // Event type delivered
  timestamp: Date;           // Delivery attempt timestamp
  statusCode: number;        // HTTP response status code
  responseBody: string;      // Response body content
  latencyMs: number;         // Delivery latency in milliseconds
  retryCount: number;        // Current retry attempt number
  errorMessage: string;      // Error details if failed
}

/**
 * Main webhook configuration interface
 * Combines all webhook-related settings and metadata
 */
export interface WebhookConfig {
  id: string;                     // Unique webhook identifier
  url: string;                    // Webhook endpoint URL
  events: WebhookEvent[];         // Subscribed event types
  secret: string;                 // HMAC signing secret
  status: WebhookStatus;          // Current operational status
  retryConfig: WebhookRetryConfig; // Retry configuration
  securityConfig: WebhookSecurityConfig; // Security settings
  metadata: WebhookMetadata;      // Monitoring and audit data
}