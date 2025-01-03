/**
 * Enhanced Email Handler Implementation
 * Provides secure email processing with comprehensive monitoring and reliability features
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import winston from 'winston';
import * as amqplib from 'amqplib';
import { CircuitBreaker } from 'circuit-breaker-ts';
import { Counter, Gauge, Histogram } from 'prom-client';

import { EmailMessage } from '../interfaces/email.interface';
import { ImapService } from '../services/imap.service';
import { SMTPService } from '../services/smtp.service';
import { AttachmentHandler } from './attachment.handler';

// Constants for email processing
const MAX_RETRY_ATTEMPTS = 3;
const QUEUE_NAME = 'email-processing';
const DLQ_NAME = 'email-processing-dlq';
const CONNECTION_POOL_SIZE = 10;
const SECURITY_CHECK_INTERVAL = 300000; // 5 minutes

@injectable()
export class EmailHandler {
  private readonly logger: winston.Logger;
  private messageQueue!: amqplib.Channel;
  private readonly metrics: {
    processedEmails: Counter;
    processingDuration: Histogram;
    activeConnections: Gauge;
    errorRate: Counter;
  };

  constructor(
    private readonly imapService: ImapService,
    private readonly smtpService: SMTPService,
    private readonly attachmentHandler: AttachmentHandler,
    private readonly circuitBreaker: CircuitBreaker
  ) {
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'email-handler.log' })
      ]
    });

    // Initialize metrics
    this.metrics = {
      processedEmails: new Counter({
        name: 'email_processed_total',
        help: 'Total number of processed emails',
        labelNames: ['status']
      }),
      processingDuration: new Histogram({
        name: 'email_processing_duration_seconds',
        help: 'Email processing duration in seconds',
        buckets: [0.1, 0.5, 1, 2, 5, 10]
      }),
      activeConnections: new Gauge({
        name: 'email_active_connections',
        help: 'Number of active email connections'
      }),
      errorRate: new Counter({
        name: 'email_processing_errors_total',
        help: 'Total number of email processing errors',
        labelNames: ['type']
      })
    };
  }

  /**
   * Initializes the email handler with enhanced security and monitoring
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing email handler');

      // Initialize IMAP service
      await this.imapService.initialize();
      
      // Setup message queue
      await this.setupMessageQueue();
      
      // Start email monitoring
      await this.startEmailMonitoring();
      
      // Start security checks
      this.startSecurityChecks();

      this.logger.info('Email handler initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize email handler', { error });
      this.metrics.errorRate.labels('initialization').inc();
      throw error;
    }
  }

  /**
   * Processes an email with enhanced security and reliability
   */
  public async processEmail(message: EmailMessage): Promise<void> {
    const startTime = process.hrtime();

    try {
      // Circuit breaker wrapped processing
      await this.circuitBreaker.execute(async () => {
        // Validate and process attachments
        if (message.attachments?.length) {
          for (const attachment of message.attachments) {
            const result = await this.attachmentHandler.processAttachment(attachment);
            if (!result.success) {
              throw new Error(`Attachment processing failed: ${result.errors.join(', ')}`);
            }
          }
        }

        // Queue message for processing
        await this.queueMessage(message);

        // Update metrics
        this.metrics.processedEmails.labels('success').inc();
        const [seconds, nanoseconds] = process.hrtime(startTime);
        this.metrics.processingDuration.observe(seconds + nanoseconds / 1e9);

        this.logger.info('Email processed successfully', { messageId: message.id });
      });
    } catch (error) {
      this.metrics.errorRate.labels('processing').inc();
      await this.handleError(error, message);
    }
  }

  /**
   * Sets up message queue with dead letter support
   */
  private async setupMessageQueue(): Promise<void> {
    try {
      const connection = await amqplib.connect(process.env.RABBITMQ_URL!);
      this.messageQueue = await connection.createChannel();

      // Setup main queue
      await this.messageQueue.assertQueue(QUEUE_NAME, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: DLQ_NAME
      });

      // Setup dead letter queue
      await this.messageQueue.assertQueue(DLQ_NAME, {
        durable: true
      });

      this.logger.info('Message queues configured successfully');
    } catch (error) {
      this.logger.error('Failed to setup message queues', { error });
      throw error;
    }
  }

  /**
   * Starts email monitoring with enhanced security
   */
  private async startEmailMonitoring(): Promise<void> {
    try {
      await this.imapService.monitorEmails();
      this.metrics.activeConnections.set(CONNECTION_POOL_SIZE);
      this.logger.info('Email monitoring started');
    } catch (error) {
      this.logger.error('Failed to start email monitoring', { error });
      throw error;
    }
  }

  /**
   * Starts periodic security checks
   */
  private startSecurityChecks(): void {
    setInterval(async () => {
      try {
        const connectionHealth = await this.imapService.getConnectionHealth();
        if (!connectionHealth.isHealthy) {
          this.logger.warn('Unhealthy connection detected', connectionHealth);
          this.metrics.errorRate.labels('connection').inc();
        }
      } catch (error) {
        this.logger.error('Security check failed', { error });
      }
    }, SECURITY_CHECK_INTERVAL);
  }

  /**
   * Queues a message for processing with retry support
   */
  private async queueMessage(message: EmailMessage): Promise<void> {
    try {
      await this.messageQueue.sendToQueue(
        QUEUE_NAME,
        Buffer.from(JSON.stringify(message)),
        {
          persistent: true,
          messageId: message.id,
          timestamp: Date.now(),
          headers: {
            'x-retry-count': '0'
          }
        }
      );
    } catch (error) {
      this.logger.error('Failed to queue message', { messageId: message.id, error });
      throw error;
    }
  }

  /**
   * Handles errors with comprehensive logging and metrics
   */
  private async handleError(error: unknown, message: EmailMessage): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    this.logger.error('Email processing failed', {
      messageId: message.id,
      error: errorMessage,
      attachments: message.attachments?.length
    });

    // Attempt to move to DLQ if retry limit exceeded
    const retryCount = parseInt(message.processingMetadata?.attempts?.toString() || '0');
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      await this.messageQueue.sendToQueue(
        DLQ_NAME,
        Buffer.from(JSON.stringify({ message, error: errorMessage })),
        { persistent: true }
      );
      this.logger.warn('Message moved to DLQ', { messageId: message.id });
    }

    throw error;
  }

  /**
   * Returns current metrics for monitoring
   */
  public getMetrics(): any {
    return {
      processedEmails: this.metrics.processedEmails.get(),
      processingDuration: this.metrics.processingDuration.get(),
      activeConnections: this.metrics.activeConnections.get(),
      errorRate: this.metrics.errorRate.get()
    };
  }
}