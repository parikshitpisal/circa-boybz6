/**
 * SMTP Service Implementation
 * Handles secure email sending with enhanced monitoring and reliability features
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import nodemailer, { Transporter, createTransport } from 'nodemailer'; // v6.9.0
import winston from 'winston'; // v3.8.0
import retry from 'retry'; // v0.13.0
import { Counter, Histogram } from 'prom-client'; // v14.0.0

import { EmailConfig, EmailMessage } from '../interfaces/email.interface';
import { validateEmailMessage } from '../utils/email.validator';
import { emailConfig } from '../config/email.config';

@injectable()
export class SMTPService {
  private transporter: Transporter;
  private readonly logger: winston.Logger;
  private readonly config: EmailConfig;
  private readonly retryOperation: retry.OperationOptions;

  // Metrics
  private readonly emailSendCounter: Counter;
  private readonly emailLatencyHistogram: Histogram;

  constructor() {
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'smtp-error.log', level: 'error' })
      ]
    });

    // Initialize metrics
    this.emailSendCounter = new Counter({
      name: 'email_send_total',
      help: 'Total number of emails sent',
      labelNames: ['status']
    });

    this.emailLatencyHistogram = new Histogram({
      name: 'email_send_duration_seconds',
      help: 'Email sending duration in seconds',
      buckets: [0.1, 0.5, 1, 2, 5]
    });

    // Load configuration
    this.config = emailConfig.smtp;

    // Configure retry strategy
    this.retryOperation = {
      retries: emailConfig.emailProcessing.retryStrategy.maxAttempts,
      factor: emailConfig.emailProcessing.retryStrategy.backoffFactor,
      minTimeout: emailConfig.emailProcessing.retryStrategy.initialDelay,
      maxTimeout: emailConfig.emailProcessing.retryStrategy.maxDelay
    };

    // Initialize SMTP transporter
    this.initializeTransporter();
  }

  /**
   * Initializes SMTP transporter with secure configuration
   */
  private initializeTransporter(): void {
    try {
      this.transporter = createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: {
          type: 'OAuth2',
          user: this.config.auth.user,
          ...this.config.auth.oauth2
        },
        tls: {
          minVersion: 'TLSv1.3',
          ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
          rejectUnauthorized: true
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100
      });

      this.logger.info('SMTP transporter initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SMTP transporter', { error });
      throw error;
    }
  }

  /**
   * Sends an email with retry mechanism and monitoring
   * @param message Email message to send
   */
  public async sendEmail(message: EmailMessage): Promise<void> {
    const startTime = Date.now();

    try {
      // Validate email message
      const validationResult = await validateEmailMessage(message, {
        validateSender: true,
        validateAttachments: true,
        validateHeaders: true
      });

      if (!validationResult.isValid) {
        throw new Error(`Email validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Configure retry operation
      const operation = retry.operation(this.retryOperation);

      await new Promise<void>((resolve, reject) => {
        operation.attempt(async (currentAttempt) => {
          try {
            await this.transporter.sendMail({
              from: message.from,
              to: message.to,
              subject: message.subject,
              text: message.text,
              html: message.html,
              attachments: message.attachments?.map(att => ({
                filename: att.filename,
                content: att.content,
                contentType: att.contentType
              })),
              headers: {
                'X-Priority': 'normal',
                'X-Mailer': 'DollarFunding-EmailService',
                'Message-ID': `<${Date.now()}-${message.from}>`
              },
              dkim: message.dkim
            });

            this.emailSendCounter.labels('success').inc();
            this.logger.info('Email sent successfully', {
              messageId: message.id,
              attempt: currentAttempt
            });

            resolve();
          } catch (error) {
            if (operation.retry(error as Error)) {
              this.logger.warn('Retrying email send', {
                messageId: message.id,
                attempt: currentAttempt,
                error
              });
              return;
            }
            reject(operation.mainError());
          }
        });
      });
    } catch (error) {
      this.emailSendCounter.labels('failure').inc();
      this.logger.error('Failed to send email', { error, messageId: message.id });
      throw error;
    } finally {
      const duration = (Date.now() - startTime) / 1000;
      this.emailLatencyHistogram.observe(duration);
    }
  }

  /**
   * Verifies SMTP connection and security features
   */
  public async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      this.logger.error('SMTP connection verification failed', { error });
      return false;
    }
  }
}