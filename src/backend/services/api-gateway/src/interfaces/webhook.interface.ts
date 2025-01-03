/**
 * Webhook interface definitions for API Gateway service
 * Provides comprehensive type definitions for webhook configurations, events, and monitoring
 * @version 1.0.0
 */

import { BaseDocument } from '../../../shared/interfaces/common';

/**
 * Enum defining all possible webhook event types for application and document processing
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
  DATA_VALIDATED = 'DATA_VALIDATED'
}

/**
 * Enum defining possible webhook endpoint status values
 */
export enum WebhookStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  FAILED = 'FAILED',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION'
}

/**
 * Interface for configuring webhook retry behavior with exponential backoff
 */
export interface WebhookRetryConfig {
  maxRetries: number;
  backoffRate: number;
  initialDelay: number;
  maxDelay: number;
  enableJitter: boolean;
  timeoutMs: number;
}

/**
 * Interface for comprehensive webhook security settings
 * Implements HMAC signatures and TLS 1.3 as per technical requirements
 */
export interface WebhookSecurityConfig {
  signatureHeader: string;
  signatureVersion: string;
  tlsVersion: string;
  allowedIpRanges: string[];
  authToken: string;
  enablePayloadEncryption: boolean;
  encryptionAlgorithm: string;
  secretExpiryDate: Date;
}

/**
 * Interface for webhook health monitoring metrics
 */
export interface WebhookHealthStatus {
  isHealthy: boolean;
  uptime: number;
  successRate: number;
  lastError: string;
  lastHealthCheck: Date;
}

/**
 * Interface for detailed webhook monitoring and tracking information
 */
export interface WebhookMetadata {
  description: string;
  labels: Record<string, string>;
  createdBy: string;
  updatedBy: string;
  lastSuccess: Date;
  lastFailure: Date;
  failureCount: number;
  successCount: number;
  averageLatencyMs: number;
  eventCounts: Record<string, number>;
  healthStatus: WebhookHealthStatus;
}

/**
 * Interface for tracking individual webhook delivery attempts
 */
export interface WebhookDeliveryMetadata {
  attemptNumber: number;
  deliveryLatency: number;
  sourceIp: string;
  userAgent: string;
  headers: Record<string, string>;
}

/**
 * Interface for structured webhook event payload
 */
export interface WebhookPayload {
  event: WebhookEvent;
  version: string;
  timestamp: Date;
  data: Record<string, unknown>;
  deliveryId: string;
  signature: string;
  deliveryMetadata: WebhookDeliveryMetadata;
}

/**
 * Comprehensive interface for webhook configuration and management
 * Extends BaseDocument to inherit core tracking fields
 */
export interface WebhookConfig extends BaseDocument {
  url: string;
  events: WebhookEvent[];
  secret: string;
  status: WebhookStatus;
  retryConfig: WebhookRetryConfig;
  securityConfig: WebhookSecurityConfig;
  metadata: WebhookMetadata;
  rateLimit: number;
  payloadSizeLimit: number;
  enableBatchDelivery: boolean;
  customHeaders: Record<string, string>;
}

/**
 * Type guard to check if an object implements WebhookConfig interface
 * @param config - Object to validate
 * @returns boolean indicating if object implements WebhookConfig
 */
export function isWebhookConfig(config: unknown): config is WebhookConfig {
  if (!config || typeof config !== 'object') {
    return false;
  }

  const webhook = config as WebhookConfig;

  return (
    typeof webhook.id === 'string' &&
    webhook.createdAt instanceof Date &&
    webhook.updatedAt instanceof Date &&
    typeof webhook.url === 'string' &&
    Array.isArray(webhook.events) &&
    webhook.events.every(event => Object.values(WebhookEvent).includes(event)) &&
    typeof webhook.secret === 'string' &&
    Object.values(WebhookStatus).includes(webhook.status) &&
    typeof webhook.retryConfig === 'object' &&
    typeof webhook.securityConfig === 'object' &&
    typeof webhook.metadata === 'object'
  );
}