import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { createServer, Server } from 'http';
import { register } from 'prom-client';
import correlator from 'express-correlation-id';
import rateLimit from 'express-rate-limit';
import healthCheck from 'express-health-check';

import applicationRouter from './routes/application.routes';
import documentRouter from './routes/document.routes';
import webhookRouter from './routes/webhook.routes';
import { errorHandler } from './middleware/error.middleware';
import { loggerInstance as logger } from './utils/logger';
import { config } from './config';
import { HTTP_STATUS } from '../../../shared/constants';

/**
 * Initializes and configures the Express application with comprehensive middleware chain
 * @returns Configured Express application instance
 */
function initializeApp(): Application {
  const app: Application = express();

  // Security middleware configuration
  app.use(helmet({
    contentSecurityPolicy: true,
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: true,
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // CORS configuration with whitelist
  app.use(cors({
    origin: config.server.corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Correlation-ID'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Request parsing middleware
  app.use(express.json({ 
    limit: config.server.maxPayloadSize,
    type: ['application/json', 'application/vnd.api+json']
  }));
  app.use(express.urlencoded({ 
    extended: true,
    limit: config.server.maxPayloadSize
  }));

  // Compression middleware
  app.use(compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }));

  // Request correlation middleware
  app.use(correlator());

  // Structured logging middleware
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));

  // Global rate limiting middleware
  const limiter = rateLimit({
    windowMs: config.rateLimiting.standardTier.windowSeconds * 1000,
    max: config.rateLimiting.standardTier.hourlyLimit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
        error: 'Rate limit exceeded',
        retryAfter: res.getHeader('Retry-After')
      });
    }
  });
  app.use(limiter);

  // Health check endpoint
  app.use('/health', healthCheck());

  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).end();
    }
  });

  // API routes
  app.use('/api/v1/applications', applicationRouter);
  app.use('/api/v1/documents', documentRouter);
  app.use('/api/v1/webhooks', webhookRouter);

  // Global error handling middleware
  app.use(errorHandler);

  return app;
}

/**
 * Starts the HTTP server with proper error handling and shutdown hooks
 * @param app Configured Express application
 * @returns HTTP server instance
 */
function startServer(app: Application): Server {
  const server = createServer(app);

  // Configure server timeouts
  server.timeout = config.server.timeoutMs;
  server.keepAliveTimeout = 120000; // 2 minutes
  server.headersTimeout = 120000; // 2 minutes

  // Start server
  server.listen(config.server.port, () => {
    logger.info(`Server started on port ${config.server.port} in ${config.server.env} mode`);
  });

  // Error handling
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.syscall !== 'listen') {
      throw error;
    }

    switch (error.code) {
      case 'EACCES':
        logger.error(`Port ${config.server.port} requires elevated privileges`);
        process.exit(1);
      case 'EADDRINUSE':
        logger.error(`Port ${config.server.port} is already in use`);
        process.exit(1);
      default:
        throw error;
    }
  });

  // Graceful shutdown handler
  const shutdown = async () => {
    logger.info('Received shutdown signal. Closing HTTP server...');
    
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        // Close database connections, message queues, etc.
        // await db.disconnect();
        // await queue.close();
        logger.info('All connections closed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
      }
    });

    // Force shutdown after timeout
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 30000);
  };

  // Register shutdown handlers
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
}

// Initialize and export app instance
const app = initializeApp();
export { app, startServer };