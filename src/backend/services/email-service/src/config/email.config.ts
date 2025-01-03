/**
 * Email Service Configuration Module
 * Implements comprehensive email processing configuration with enhanced security
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import { EmailConfig, EmailAuth, OAuth2Config } from '../interfaces/email.interface';

// Load environment variables
config();

/**
 * Connection pool configuration for IMAP connections
 */
interface ConnectionPoolConfig {
  poolSize: number;
  idleTimeout: number;
  healthCheckInterval: number;
  maxRetries: number;
}

/**
 * TLS configuration for secure email connections
 */
interface TLSConfig {
  minVersion: string;
  ciphers: string;
  rejectUnauthorized: boolean;
}

/**
 * Email processing rules and validation configuration
 */
interface EmailProcessingConfig {
  maxAttachments: number;
  maxAttachmentSize: number;
  allowedFileTypes: string[];
  allowedDomains: string[];
  monitoredEmail: string;
  processingRules: {
    validateSender: boolean;
    validateAttachments: boolean;
    validateFileTypes: boolean;
    validateSize: boolean;
  };
  retryStrategy: {
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
    maxAttempts: number;
  };
}

/**
 * Security configuration for email service
 */
interface SecurityConfig {
  oauth2: OAuth2Config;
  tls: TLSConfig;
}

/**
 * IMAP server configuration with enhanced security and connection pooling
 */
const IMAP_CONFIG: EmailConfig = {
  host: process.env.IMAP_HOST!,
  port: Number(process.env.IMAP_PORT) || 993,
  secure: true,
  poolConfig: {
    poolSize: Number(process.env.IMAP_POOL_SIZE) || 5,
    idleTimeout: Number(process.env.IMAP_IDLE_TIMEOUT) || 300000, // 5 minutes
    healthCheckInterval: 60000, // 1 minute
    maxRetries: 3
  },
  auth: {
    user: process.env.EMAIL_USER!,
    oauth2: {
      clientId: process.env.OAUTH_CLIENT_ID!,
      clientSecret: process.env.OAUTH_CLIENT_SECRET!,
      refreshToken: process.env.OAUTH_REFRESH_TOKEN!,
      accessToken: '',
      expires: 0
    }
  },
  tls: {
    minVersion: 'TLSv1.2',
    ciphers: 'HIGH:!aNULL:!MD5',
    rejectUnauthorized: true
  }
};

/**
 * SMTP server configuration with enhanced security
 */
const SMTP_CONFIG: EmailConfig = {
  host: process.env.SMTP_HOST!,
  port: Number(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER!,
    oauth2: {
      clientId: process.env.OAUTH_CLIENT_ID!,
      clientSecret: process.env.OAUTH_CLIENT_SECRET!,
      refreshToken: process.env.OAUTH_REFRESH_TOKEN!,
      accessToken: '',
      expires: 0
    }
  },
  tls: {
    minVersion: 'TLSv1.2',
    ciphers: 'HIGH:!aNULL:!MD5',
    rejectUnauthorized: true
  }
};

/**
 * Email processing configuration with comprehensive validation rules
 */
const EMAIL_PROCESSING_CONFIG: EmailProcessingConfig = {
  maxAttachments: 10,
  maxAttachmentSize: 25 * 1024 * 1024, // 25MB
  allowedFileTypes: ['application/pdf'],
  allowedDomains: ['dollarfunding.com'],
  monitoredEmail: 'submissions@dollarfunding.com',
  processingRules: {
    validateSender: true,
    validateAttachments: true,
    validateFileTypes: true,
    validateSize: true
  },
  retryStrategy: {
    initialDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
    maxAttempts: 3
  }
};

/**
 * Security configuration for email service
 */
const SECURITY_CONFIG: SecurityConfig = {
  oauth2: {
    clientId: process.env.OAUTH_CLIENT_ID!,
    clientSecret: process.env.OAUTH_CLIENT_SECRET!,
    refreshToken: process.env.OAUTH_REFRESH_TOKEN!,
    accessToken: '',
    expires: 0
  },
  tls: {
    minVersion: 'TLSv1.2',
    ciphers: 'HIGH:!aNULL:!MD5',
    rejectUnauthorized: true
  }
};

/**
 * Validates required environment variables
 * @throws Error if required environment variables are missing
 */
function validateEnvironmentVariables(): void {
  const requiredVars = [
    'IMAP_HOST',
    'IMAP_PORT',
    'SMTP_HOST',
    'SMTP_PORT',
    'EMAIL_USER',
    'OAUTH_CLIENT_ID',
    'OAUTH_CLIENT_SECRET',
    'OAUTH_REFRESH_TOKEN'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

/**
 * Loads and validates email service configuration
 * @returns Validated email configuration object
 */
function loadEmailConfig() {
  validateEnvironmentVariables();

  return {
    imap: IMAP_CONFIG,
    smtp: SMTP_CONFIG,
    emailProcessing: EMAIL_PROCESSING_CONFIG,
    security: SECURITY_CONFIG
  };
}

// Export validated configuration
export const emailConfig = loadEmailConfig();