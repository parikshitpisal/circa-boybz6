import { config as dotenvConfig } from 'dotenv'; // ^16.0.0
import { HTTP_STATUS, API_RATE_LIMITS } from '../../../../shared/constants';

// Load environment variables
dotenvConfig();

// Global constants
const NODE_ENV = process.env.NODE_ENV || 'development';
const PORT = parseInt(process.env.PORT || '3000', 10);
const CONFIG_VERSION = process.env.CONFIG_VERSION || '1.0.0';

// Interfaces
interface ServerConfig {
  port: number;
  env: string;
  apiVersion: string;
  corsOrigins: string[];
  trustProxy: boolean;
  timeoutMs: number;
  maxPayloadSize: string;
}

interface SecurityConfig {
  jwtSecret: string;
  tokenExpiry: string;
  refreshTokenExpiry: string;
  mfaEnabled: boolean;
  encryptionKey: string;
  ipWhitelist: string[];
  allowedOrigins: string[];
  securityHeaders: {
    hsts: boolean;
    noSniff: boolean;
    xssProtection: boolean;
    frameOptions: string;
  };
  hsmConfig: {
    enabled: boolean;
    provider: string;
    keyIdentifier: string;
  };
  certificatePaths: {
    cert: string;
    key: string;
    ca: string;
  };
}

interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  ssl: boolean;
  poolSize: number;
  replicationConfig: {
    enabled: boolean;
    readReplicas: string[];
  };
  backupConfig: {
    enabled: boolean;
    schedule: string;
    retention: number;
  };
}

interface CacheConfig {
  host: string;
  port: number;
  password: string;
  ttl: number;
  clusterMode: boolean;
  keyPrefix: string;
  maxMemoryPolicy: string;
}

interface QueueConfig {
  url: string;
  exchange: string;
  queues: string[];
  deadLetterExchange: string;
  retryPolicy: {
    attempts: number;
    backoff: number;
  };
  prefetchCount: number;
}

interface RateLimitConfig {
  enabled: boolean;
  standardTier: typeof API_RATE_LIMITS.STANDARD_TIER;
  premiumTier: typeof API_RATE_LIMITS.PREMIUM_TIER;
  internalTier: {
    hourlyLimit: number;
    burstLimit: number;
    windowSeconds: number;
  };
  whitelistedIPs: string[];
  blacklistedIPs: string[];
  customRules: Array<{
    path: string;
    limit: number;
    window: number;
  }>;
  rateLimitHeaders: boolean;
}

interface MonitoringConfig {
  enabled: boolean;
  metricsEndpoint: string;
  logLevel: string;
  tracing: {
    enabled: boolean;
    samplingRate: number;
  };
  alerting: {
    enabled: boolean;
    endpoints: string[];
    thresholds: {
      errorRate: number;
      responseTime: number;
    };
  };
}

// Configuration validator
function validateConfig(): void {
  const requiredEnvVars = [
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'DATABASE_URL',
    'REDIS_URL',
    'QUEUE_URL'
  ];

  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  });

  // Additional validation checks
  if (!config.security.jwtSecret || config.security.jwtSecret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters long');
  }

  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error('Invalid port number');
  }

  // Validate IP whitelist format
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  config.security.ipWhitelist.forEach(ip => {
    if (!ipRegex.test(ip)) {
      throw new Error(`Invalid IP address format: ${ip}`);
    }
  });
}

// Export configuration object
export const config = {
  server: {
    port: PORT,
    env: NODE_ENV,
    apiVersion: 'v1',
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    trustProxy: process.env.TRUST_PROXY === 'true',
    timeoutMs: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
    maxPayloadSize: process.env.MAX_PAYLOAD_SIZE || '10mb'
  } as ServerConfig,

  security: {
    jwtSecret: process.env.JWT_SECRET!,
    tokenExpiry: process.env.TOKEN_EXPIRY || '1h',
    refreshTokenExpiry: process.env.REFRESH_TOKEN_EXPIRY || '24h',
    mfaEnabled: process.env.MFA_ENABLED === 'true',
    encryptionKey: process.env.ENCRYPTION_KEY!,
    ipWhitelist: process.env.IP_WHITELIST?.split(',') || [],
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    securityHeaders: {
      hsts: true,
      noSniff: true,
      xssProtection: true,
      frameOptions: 'DENY'
    },
    hsmConfig: {
      enabled: process.env.HSM_ENABLED === 'true',
      provider: process.env.HSM_PROVIDER || 'aws',
      keyIdentifier: process.env.HSM_KEY_ID || ''
    },
    certificatePaths: {
      cert: process.env.SSL_CERT_PATH || '',
      key: process.env.SSL_KEY_PATH || '',
      ca: process.env.SSL_CA_PATH || ''
    }
  } as SecurityConfig,

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'application_intake',
    ssl: process.env.DB_SSL === 'true',
    poolSize: parseInt(process.env.DB_POOL_SIZE || '10', 10),
    replicationConfig: {
      enabled: process.env.DB_REPLICATION_ENABLED === 'true',
      readReplicas: process.env.DB_READ_REPLICAS?.split(',') || []
    },
    backupConfig: {
      enabled: process.env.DB_BACKUP_ENABLED === 'true',
      schedule: process.env.DB_BACKUP_SCHEDULE || '0 0 * * *',
      retention: parseInt(process.env.DB_BACKUP_RETENTION || '7', 10)
    }
  } as DatabaseConfig,

  cache: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    ttl: parseInt(process.env.REDIS_TTL || '3600', 10),
    clusterMode: process.env.REDIS_CLUSTER === 'true',
    keyPrefix: process.env.REDIS_PREFIX || 'api:',
    maxMemoryPolicy: process.env.REDIS_MEMORY_POLICY || 'allkeys-lru'
  } as CacheConfig,

  queue: {
    url: process.env.QUEUE_URL || 'amqp://localhost',
    exchange: process.env.QUEUE_EXCHANGE || 'application_intake',
    queues: process.env.QUEUE_NAMES?.split(',') || ['documents', 'notifications'],
    deadLetterExchange: process.env.QUEUE_DLX || 'application_intake_dlx',
    retryPolicy: {
      attempts: parseInt(process.env.QUEUE_RETRY_ATTEMPTS || '3', 10),
      backoff: parseInt(process.env.QUEUE_RETRY_BACKOFF || '1000', 10)
    },
    prefetchCount: parseInt(process.env.QUEUE_PREFETCH || '10', 10)
  } as QueueConfig,

  rateLimiting: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    standardTier: API_RATE_LIMITS.STANDARD_TIER,
    premiumTier: API_RATE_LIMITS.PREMIUM_TIER,
    internalTier: {
      hourlyLimit: -1,
      burstLimit: 1000,
      windowSeconds: 60
    },
    whitelistedIPs: process.env.RATE_LIMIT_WHITELIST?.split(',') || [],
    blacklistedIPs: process.env.RATE_LIMIT_BLACKLIST?.split(',') || [],
    customRules: [],
    rateLimitHeaders: true
  } as RateLimitConfig,

  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    metricsEndpoint: process.env.METRICS_ENDPOINT || '/metrics',
    logLevel: process.env.LOG_LEVEL || 'info',
    tracing: {
      enabled: process.env.TRACING_ENABLED === 'true',
      samplingRate: parseFloat(process.env.TRACING_SAMPLING_RATE || '0.1')
    },
    alerting: {
      enabled: process.env.ALERTING_ENABLED === 'true',
      endpoints: process.env.ALERT_ENDPOINTS?.split(',') || [],
      thresholds: {
        errorRate: parseFloat(process.env.ALERT_ERROR_THRESHOLD || '0.05'),
        responseTime: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD || '1000', 10)
      }
    }
  } as MonitoringConfig
};

// Validate configuration on load
validateConfig();

// Export configuration
export default config;