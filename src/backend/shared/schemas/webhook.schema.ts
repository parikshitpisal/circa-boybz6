/**
 * Webhook schema definitions with enhanced security features and validation
 * @version 1.0.0
 * @package zod ^3.21.4
 */

import { z } from 'zod';
import { BaseDocument } from '../interfaces/common';

/**
 * Webhook event types for application and document processing notifications
 */
export const WebhookEventSchema = z.enum([
  'APPLICATION_CREATED',
  'APPLICATION_UPDATED',
  'APPLICATION_COMPLETED',
  'DOCUMENT_PROCESSED',
  'DOCUMENT_FAILED'
]);

/**
 * Webhook operational status types
 */
export const WebhookStatusSchema = z.enum([
  'ACTIVE',
  'INACTIVE',
  'FAILED'
]);

/**
 * TLS version enum with strict security requirements
 */
const TLSVersionSchema = z.enum(['1.2', '1.3']).default('1.3');

/**
 * HMAC signature version enum for webhook security
 */
const SignatureVersionSchema = z.enum(['v1', 'v2']).default('v2');

/**
 * Enhanced security configuration for webhooks
 */
export const WebhookSecurityConfigSchema = z.object({
  signatureHeader: z.string().min(1).default('X-Webhook-Signature'),
  signatureVersion: SignatureVersionSchema,
  tlsVersion: TLSVersionSchema,
  ipWhitelist: z.array(z.string().ip()).optional(),
  certificatePinning: z.boolean().default(false)
});

/**
 * Retry configuration for failed webhook deliveries
 */
export const WebhookRetryConfigSchema = z.object({
  maxRetries: z.number().int().min(1).max(10).default(3),
  backoffRate: z.number().min(1.1).max(5).default(2),
  initialDelay: z.number().min(1000).max(60000).default(5000)
});

/**
 * Rate limiting configuration for webhook endpoints
 */
const WebhookRateLimitSchema = z.object({
  maxRequests: z.number().int().min(1).max(1000).default(100),
  windowSeconds: z.number().int().min(1).max(3600).default(60)
});

/**
 * Comprehensive webhook configuration schema with enhanced security
 */
export const WebhookConfigSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url().regex(/^https:\/\//i, 'HTTPS protocol required'),
  events: z.array(WebhookEventSchema).min(1),
  secret: z.string().min(32).max(128),
  status: WebhookStatusSchema.default('ACTIVE'),
  retryConfig: WebhookRetryConfigSchema,
  securityConfig: WebhookSecurityConfigSchema,
  rateLimit: WebhookRateLimitSchema,
  createdAt: z.date(),
  updatedAt: z.date()
}).strict();

/**
 * Type definitions derived from schemas
 */
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;
export type WebhookStatus = z.infer<typeof WebhookStatusSchema>;
export type WebhookSecurityConfig = z.infer<typeof WebhookSecurityConfigSchema>;
export type WebhookRetryConfig = z.infer<typeof WebhookRetryConfigSchema>;
export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

/**
 * Interface extending BaseDocument for webhook configuration
 */
export interface WebhookType extends BaseDocument {
  url: string;
  events: WebhookEvent[];
  secret: string;
  status: WebhookStatus;
  retryConfig: WebhookRetryConfig;
  securityConfig: WebhookSecurityConfig;
  rateLimit: {
    maxRequests: number;
    windowSeconds: number;
  };
}

/**
 * Validates a webhook configuration with enhanced security checks
 * @param config - Webhook configuration to validate
 * @returns Validated webhook configuration
 * @throws ZodError if validation fails
 */
export function validateWebhookConfig(config: unknown): WebhookConfig {
  return WebhookConfigSchema.parse(config);
}

/**
 * Validates webhook payload with security constraints
 * @param payload - Webhook payload to validate
 * @returns Validated webhook payload
 * @throws ZodError if validation fails
 */
export const validateWebhookPayload = (payload: unknown) => {
  const WebhookPayloadSchema = z.object({
    id: z.string().uuid(),
    event: WebhookEventSchema,
    timestamp: z.date().max(new Date(Date.now() + 300000)), // Max 5 minutes in future
    data: z.record(z.unknown()),
    metadata: z.object({
      version: z.string(),
      attemptNumber: z.number().int().min(1)
    })
  }).strict();

  return WebhookPayloadSchema.parse(payload);
};