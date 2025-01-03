import express, { Router } from 'express'; // ^4.18.0
import rateLimit from 'express-rate-limit'; // ^6.7.0
import { WebhookController } from '../controllers/webhook.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { errorHandler } from '../middleware/error.middleware';
import { z } from 'zod'; // ^3.22.0

// Webhook configuration validation schema
const webhookSchema = z.object({
  url: z.string()
    .url('Must be a valid URL')
    .regex(/^https:\/\//, 'Must use HTTPS protocol'),
  events: z.array(z.string())
    .min(1, 'At least one event type must be specified')
    .max(10, 'Cannot exceed 10 event types'),
  metadata: z.object({
    description: z.string().max(200).optional(),
    labels: z.record(z.string()).optional()
  }).optional(),
  ipWhitelist: z.array(z.string()
    .regex(/^(?:\d{1,3}\.){3}\d{1,3}$/, 'Must be valid IP addresses'))
    .optional()
});

// Rate limiting configurations based on endpoint sensitivity
const createWebhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: 'Too many webhook creation attempts, please try again later'
});

const standardWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Rate limit exceeded for webhook operations'
});

const sensitiveWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Rate limit exceeded for sensitive webhook operations'
});

/**
 * Initializes webhook routes with comprehensive security and monitoring
 * @param webhookController - Instance of WebhookController
 * @returns Configured Express router
 */
export function initializeWebhookRoutes(webhookController: WebhookController): Router {
  const router = express.Router();

  // Apply authentication to all routes
  router.use(authenticate);

  // Create webhook endpoint
  router.post('/webhooks',
    authorize(['admin', 'operator']),
    createWebhookLimiter,
    validateRequest(webhookSchema),
    webhookController.createWebhook
  );

  // List webhooks endpoint
  router.get('/webhooks',
    authorize(['admin', 'operator', 'auditor']),
    standardWebhookLimiter,
    webhookController.getWebhooks
  );

  // Get specific webhook endpoint
  router.get('/webhooks/:id',
    authorize(['admin', 'operator', 'auditor']),
    standardWebhookLimiter,
    webhookController.getWebhook
  );

  // Update webhook endpoint
  router.put('/webhooks/:id',
    authorize(['admin', 'operator']),
    standardWebhookLimiter,
    validateRequest(webhookSchema),
    webhookController.updateWebhook
  );

  // Delete webhook endpoint
  router.delete('/webhooks/:id',
    authorize(['admin']),
    sensitiveWebhookLimiter,
    webhookController.deleteWebhook
  );

  // Test webhook endpoint
  router.post('/webhooks/:id/test',
    authorize(['admin', 'operator']),
    standardWebhookLimiter,
    webhookController.testWebhook
  );

  // Rotate webhook secret endpoint
  router.post('/webhooks/:id/rotate-secret',
    authorize(['admin']),
    sensitiveWebhookLimiter,
    webhookController.rotateWebhookSecret
  );

  // Get webhook metrics endpoint
  router.get('/webhooks/:id/metrics',
    authorize(['admin', 'operator']),
    standardWebhookLimiter,
    webhookController.getWebhookMetrics
  );

  // Apply error handling middleware
  router.use(errorHandler);

  return router;
}

export default initializeWebhookRoutes;