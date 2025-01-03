/**
 * Main Application Entry Point for Email Service
 * Implements secure email monitoring and processing with enhanced reliability features
 * @version 1.0.0
 */

import express from 'express'; // ^4.18.0
import winston from 'winston'; // ^3.8.0
import { config } from 'dotenv'; // ^16.0.0
import { connect } from 'amqplib'; // ^0.10.0
import { Registry, collectDefaultMetrics } from 'prom-client'; // ^14.0.0
import { CircuitBreaker } from 'circuit-breaker-js'; // ^0.5.0
import { injectable } from 'inversify';

import { emailConfig } from './config/email.config';
import { EmailHandler } from './handlers/email.handler';
import { ImapService } from './services/imap.service';

// Load environment variables
config();

// Constants
const PORT = process.env.PORT || 3002;
const SHUTDOWN_TIMEOUT = 5000;
const SECURITY_SETTINGS = {
  minTlsVersion: 'TLSv1.3',
  cipherPreference: 'modern'
};

@injectable()
class EmailServiceApp {
  private readonly app: express.Application;
  private readonly logger: winston.Logger;
  private readonly metrics: Registry;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly emailHandler: EmailHandler,
    private readonly imapService: ImapService
  ) {
    // Initialize Express application
    this.app = express();

    // Initialize logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'email-service-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'email-service-combined.log' })
      ]
    });

    // Initialize metrics
    this.metrics = new Registry();
    collectDefaultMetrics({ register: this.metrics });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      windowDuration: 60000,
      numBuckets: 10,
      timeoutDuration: 30000,
      errorThreshold: 50,
      volumeThreshold: 10
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Initialize the application with security features
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Email Service Application');

      // Validate environment variables
      this.validateEnvironment();

      // Initialize email handler with circuit breaker
      await this.circuitBreaker.execute(async () => {
        await this.emailHandler.initialize();
      });

      // Initialize IMAP service with enhanced security
      await this.imapService.initialize();

      // Setup health checks and monitoring
      this.setupHealthCheck();

      // Start the server
      await this.startServer();

      this.logger.info('Email Service Application initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize application', { error });
      throw error;
    }
  }

  /**
   * Setup Express middleware with security features
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(express.json({ limit: '1mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    
    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        this.logger.info('Request processed', {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          duration: Date.now() - start
        });
      });
      next();
    });
  }

  /**
   * Setup application routes
   */
  private setupRoutes(): void {
    this.app.get('/', (req, res) => {
      res.json({ status: 'Email Service Operational' });
    });
  }

  /**
   * Setup health check endpoints with detailed status
   */
  private setupHealthCheck(): void {
    // Basic health check
    this.app.get('/health', async (req, res) => {
      try {
        const imapStatus = await this.imapService.getConnectionPoolStatus();
        const handlerStatus = await this.emailHandler.getMetrics();

        res.json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            imap: imapStatus,
            handler: handlerStatus
          }
        });
      } catch (error) {
        res.status(500).json({
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Prometheus metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', this.metrics.contentType);
        res.end(await this.metrics.metrics());
      } catch (error) {
        res.status(500).end();
      }
    });
  }

  /**
   * Validate required environment variables
   */
  private validateEnvironment(): void {
    const required = [
      'PORT',
      'NODE_ENV',
      'RABBITMQ_URL',
      'IMAP_HOST',
      'SMTP_HOST',
      'EMAIL_USER'
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Start the Express server
   */
  private async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const server = this.app.listen(PORT, () => {
          this.logger.info(`Email Service listening on port ${PORT}`);
          resolve();
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
          this.logger.info('SIGTERM received, starting graceful shutdown');
          server.close(async () => {
            try {
              await this.shutdown();
              process.exit(0);
            } catch (error) {
              this.logger.error('Error during shutdown', { error });
              process.exit(1);
            }
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Graceful shutdown handler
   */
  private async shutdown(): Promise<void> {
    this.logger.info('Initiating graceful shutdown');
    
    try {
      // Stop accepting new connections
      await this.imapService.shutdown();
      
      // Wait for ongoing operations to complete
      await new Promise(resolve => setTimeout(resolve, SHUTDOWN_TIMEOUT));
      
      this.logger.info('Graceful shutdown completed');
    } catch (error) {
      this.logger.error('Error during shutdown', { error });
      throw error;
    }
  }
}

/**
 * Start the email service application
 */
export async function startServer(): Promise<void> {
  try {
    const app = new EmailServiceApp(
      new EmailHandler(/* dependencies */),
      new ImapService(emailConfig.imap)
    );
    await app.initialize();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Export the EmailServiceApp class for testing
export { EmailServiceApp };