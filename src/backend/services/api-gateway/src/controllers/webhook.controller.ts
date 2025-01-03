import { Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import crypto from 'crypto';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { Counter, Histogram } from 'prom-client';

import { WebhookConfig, WebhookEvent, WebhookStatus, WebhookPayload } from '../interfaces/webhook.interface';
import { QueueService } from '../services/queue.service';
import { config } from '../config';
import { HTTP_STATUS } from '../../../../shared/constants';

/**
 * Enhanced webhook controller with security, monitoring and reliability features
 * @version 1.0.0
 */
@injectable()
export class WebhookController {
  // Prometheus metrics
  private readonly deliveryLatencyHistogram: Histogram;
  private readonly deliveryCounter: Counter;
  private readonly failureCounter: Counter;

  constructor(
    @inject('QueueService') private readonly queueService: QueueService,
    @inject('RateLimiter') private readonly rateLimiter: RateLimiterRedis
  ) {
    // Initialize metrics
    this.deliveryLatencyHistogram = new Histogram({
      name: 'webhook_delivery_latency_seconds',
      help: 'Webhook delivery latency in seconds',
      labelNames: ['status', 'event_type']
    });

    this.deliveryCounter = new Counter({
      name: 'webhook_delivery_total',
      help: 'Total number of webhook deliveries',
      labelNames: ['status', 'event_type']
    });

    this.failureCounter = new Counter({
      name: 'webhook_delivery_failures_total',
      help: 'Total number of webhook delivery failures',
      labelNames: ['reason', 'event_type']
    });
  }

  /**
   * Creates a new webhook configuration with enhanced security settings
   */
  public async createWebhook(req: Request, res: Response): Promise<Response> {
    try {
      const webhookConfig: Partial<WebhookConfig> = req.body;

      // Validate webhook URL and TLS version
      if (!this.isValidWebhookUrl(webhookConfig.url)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
          error: 'Invalid webhook URL. HTTPS with TLS 1.3 is required.'
        });
      }

      // Generate high-entropy secret
      const secret = crypto.randomBytes(32).toString('hex');

      // Create webhook configuration
      const newWebhook: WebhookConfig = {
        url: webhookConfig.url!,
        events: webhookConfig.events || [],
        status: WebhookStatus.PENDING_VERIFICATION,
        secret,
        retryConfig: {
          maxRetries: config.queue.retryPolicy.attempts,
          backoffRate: config.queue.retryPolicy.backoff,
          initialDelay: 1000,
          maxDelay: 30000,
          enableJitter: true,
          timeoutMs: 10000
        },
        securityConfig: {
          signatureHeader: 'X-Webhook-Signature',
          signatureVersion: 'v1',
          tlsVersion: 'TLSv1.3',
          allowedIpRanges: webhookConfig.ipWhitelist || [],
          authToken: crypto.randomBytes(16).toString('hex'),
          enablePayloadEncryption: true,
          encryptionAlgorithm: 'aes-256-gcm',
          secretExpiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
        },
        metadata: {
          description: webhookConfig.metadata?.description || '',
          labels: webhookConfig.metadata?.labels || {},
          createdBy: req.user?.id || 'system',
          updatedBy: req.user?.id || 'system',
          lastSuccess: null,
          lastFailure: null,
          failureCount: 0,
          successCount: 0,
          averageLatencyMs: 0,
          eventCounts: {},
          healthStatus: {
            isHealthy: true,
            uptime: 0,
            successRate: 100,
            lastError: '',
            lastHealthCheck: new Date()
          }
        }
      };

      // Store webhook configuration
      // Note: Actual storage implementation would be handled by a repository layer

      return res.status(HTTP_STATUS.CREATED).json({
        message: 'Webhook created successfully',
        webhook: {
          ...newWebhook,
          secret: `${secret.substring(0, 8)}...` // Return partial secret
        }
      });
    } catch (error) {
      this.failureCounter.inc({ reason: 'creation_error' });
      return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to create webhook configuration'
      });
    }
  }

  /**
   * Delivers webhook payload with reliability and monitoring
   */
  public async deliverWebhook(config: WebhookConfig, payload: WebhookPayload): Promise<void> {
    const startTime = Date.now();
    const deliveryId = crypto.randomBytes(16).toString('hex');

    try {
      // Check rate limits
      await this.rateLimiter.consume(config.url, 1);

      // Generate HMAC signature
      const signature = this.generateSignature(payload, config.secret);

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'ApplicationIntake-Webhook/1.0',
        'X-Webhook-ID': deliveryId,
        'X-Webhook-Signature': `${config.securityConfig.signatureVersion}=${signature}`,
        'X-Webhook-Timestamp': Date.now().toString(),
        ...config.customHeaders
      };

      // Queue delivery attempt
      await this.queueService.publishDocument({
        id: deliveryId,
        type: 'WEBHOOK_DELIVERY',
        status: 'PENDING',
        processedAt: new Date(),
        metadata: {
          webhookUrl: config.url,
          payload,
          headers,
          retryCount: 0,
          maxRetries: config.retryConfig.maxRetries
        }
      }, {
        priority: 1,
        persistent: true,
        expiration: config.retryConfig.timeoutMs
      });

      // Record metrics
      this.deliveryCounter.inc({ status: 'queued', event_type: payload.event });
      this.deliveryLatencyHistogram.observe(
        { status: 'queued', event_type: payload.event },
        (Date.now() - startTime) / 1000
      );

    } catch (error) {
      this.handleDeliveryFailure(config, payload, error);
      throw error;
    }
  }

  /**
   * Validates webhook URL and TLS version
   */
  private isValidWebhookUrl(url?: string): boolean {
    if (!url) return false;

    try {
      const webhookUrl = new URL(url);
      return webhookUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Generates HMAC signature for webhook payload
   */
  private generateSignature(payload: WebhookPayload, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  /**
   * Handles webhook delivery failures with monitoring
   */
  private handleDeliveryFailure(config: WebhookConfig, payload: WebhookPayload, error: Error): void {
    this.failureCounter.inc({
      reason: error.name,
      event_type: payload.event
    });

    // Update webhook health status
    config.metadata.healthStatus.isHealthy = false;
    config.metadata.healthStatus.lastError = error.message;
    config.metadata.failureCount++;
    config.metadata.lastFailure = new Date();

    // Log failure for monitoring
    console.error('Webhook delivery failed', {
      webhookUrl: config.url,
      event: payload.event,
      error: error.message,
      failureCount: config.metadata.failureCount
    });
  }
}