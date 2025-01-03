import { ApiService } from './api.service';
import { API_ENDPOINTS } from '../constants/api.constants';
import {
  WebhookConfig,
  WebhookEvent,
  WebhookStatus,
  WebhookSecurityConfig,
  WebhookRetryConfig,
  WebhookDeliveryStatus
} from '../interfaces/webhook.interface';

/**
 * Enhanced WebhookService for managing secure webhook configurations and operations
 * Implements webhook integration requirements from Technical Specifications Section 3.3.4
 * @version 1.0.0
 */
export class WebhookService {
  private readonly HMAC_ALGORITHM = 'sha256';
  private readonly DEFAULT_RETRY_CONFIG: WebhookRetryConfig = {
    maxRetries: 3,
    backoffRate: 2,
    initialDelay: 1000,
    maxDelay: 32000,
    enableJitter: true,
    timeoutSeconds: 30
  };

  constructor(
    private readonly apiService: ApiService,
    private readonly securityConfig: WebhookSecurityConfig = {
      signatureHeader: 'X-Webhook-Signature',
      signatureVersion: 'v1',
      tlsVersion: '1.3',
      allowedIpRanges: [],
      enforceHttps: true,
      encryptionAlgorithm: 'aes-256-gcm',
      secretRotationDays: 90
    }
  ) {}

  /**
   * Retrieves all configured webhooks with their current status
   * @returns Promise<WebhookConfig[]> List of webhook configurations
   */
  public async getWebhooks(): Promise<WebhookConfig[]> {
    const response = await this.apiService.get<WebhookConfig[]>(API_ENDPOINTS.WEBHOOKS);
    return response.map(webhook => this.enrichWebhookConfig(webhook));
  }

  /**
   * Creates a new webhook configuration with security settings
   * @param config Partial webhook configuration
   * @returns Promise<WebhookConfig> Created webhook configuration
   */
  public async createWebhook(config: Partial<WebhookConfig>): Promise<WebhookConfig> {
    this.validateWebhookConfig(config);

    const webhookConfig: Partial<WebhookConfig> = {
      ...config,
      status: WebhookStatus.ACTIVE,
      secret: await this.generateWebhookSecret(),
      retryConfig: this.DEFAULT_RETRY_CONFIG,
      securityConfig: this.securityConfig,
      metadata: {
        ...config.metadata,
        createdById: 'system',
        createdByEmail: 'system@example.com',
        version: '1.0.0',
        successRate: 100,
        failureCount: 0,
        averageLatencyMs: 0
      }
    };

    const response = await this.apiService.post<WebhookConfig>(
      API_ENDPOINTS.WEBHOOKS,
      webhookConfig
    );
    return this.enrichWebhookConfig(response);
  }

  /**
   * Updates an existing webhook configuration
   * @param id Webhook identifier
   * @param config Updated webhook configuration
   * @returns Promise<WebhookConfig> Updated webhook configuration
   */
  public async updateWebhook(id: string, config: Partial<WebhookConfig>): Promise<WebhookConfig> {
    this.validateWebhookConfig(config);
    
    const response = await this.apiService.put<WebhookConfig>(
      `${API_ENDPOINTS.WEBHOOKS}/${id}`,
      config
    );
    return this.enrichWebhookConfig(response);
  }

  /**
   * Generates HMAC signature for webhook payload
   * @param payload Webhook payload
   * @param secret Webhook secret
   * @returns string HMAC signature
   */
  public generateSignature(payload: string, secret: string): string {
    const crypto = require('crypto');
    const hmac = crypto.createHmac(this.HMAC_ALGORITHM, secret);
    const signature = hmac.update(payload).digest('hex');
    return `${this.securityConfig.signatureVersion}=${signature}`;
  }

  /**
   * Verifies webhook delivery status and health
   * @param id Webhook identifier
   * @returns Promise<WebhookDeliveryStatus> Webhook health status
   */
  public async verifyWebhookHealth(id: string): Promise<WebhookDeliveryStatus> {
    return this.apiService.get<WebhookDeliveryStatus>(
      `${API_ENDPOINTS.WEBHOOKS}/${id}/health`
    );
  }

  /**
   * Rotates webhook secret
   * @param id Webhook identifier
   * @returns Promise<WebhookConfig> Updated webhook configuration
   */
  public async rotateWebhookSecret(id: string): Promise<WebhookConfig> {
    const newSecret = await this.generateWebhookSecret();
    return this.updateWebhook(id, { secret: newSecret });
  }

  /**
   * Validates webhook configuration
   * @param config Webhook configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateWebhookConfig(config: Partial<WebhookConfig>): void {
    if (config.url && !this.isValidWebhookUrl(config.url)) {
      throw new Error('Invalid webhook URL format');
    }

    if (config.events && !this.areValidEvents(config.events)) {
      throw new Error('Invalid webhook events specified');
    }

    if (this.securityConfig.enforceHttps && !config.url?.startsWith('https://')) {
      throw new Error('HTTPS is required for webhook endpoints');
    }
  }

  /**
   * Generates a secure webhook secret
   * @returns Promise<string> Generated secret
   */
  private async generateWebhookSecret(): Promise<string> {
    const crypto = require('crypto');
    return new Promise((resolve, reject) => {
      crypto.randomBytes(32, (err: Error | null, buffer: Buffer) => {
        if (err) reject(err);
        resolve(buffer.toString('hex'));
      });
    });
  }

  /**
   * Validates webhook URL format and security requirements
   * @param url Webhook URL to validate
   * @returns boolean URL validity
   */
  private isValidWebhookUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return (
        (parsedUrl.protocol === 'https:' || !this.securityConfig.enforceHttps) &&
        parsedUrl.hostname !== 'localhost' &&
        parsedUrl.hostname !== '127.0.0.1'
      );
    } catch {
      return false;
    }
  }

  /**
   * Validates webhook event types
   * @param events Array of webhook events
   * @returns boolean Events validity
   */
  private areValidEvents(events: WebhookEvent[]): boolean {
    return events.every(event => Object.values(WebhookEvent).includes(event));
  }

  /**
   * Enriches webhook configuration with additional metadata
   * @param webhook Base webhook configuration
   * @returns WebhookConfig Enhanced webhook configuration
   */
  private enrichWebhookConfig(webhook: WebhookConfig): WebhookConfig {
    return {
      ...webhook,
      metadata: {
        ...webhook.metadata,
        lastChecked: new Date(),
        isHealthy: webhook.status === WebhookStatus.ACTIVE
      }
    };
  }
}