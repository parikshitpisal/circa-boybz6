import axios, { AxiosError } from 'axios'; // axios@1.4.0
import { API_ENDPOINTS } from '../constants/api.constants';

/**
 * Enhanced interface for comprehensive API configuration
 */
interface ApiConfig {
  baseURL: string;
  timeout: number;
  retryPolicy: {
    maxRetries: number;
    retryDelay: number;
    retryableStatusCodes: number[];
    backoffFactor: number;
    maxBackoffTime: number;
  };
  headers: Record<string, string>;
  monitoring: {
    enablePerformanceTracking: boolean;
    enableErrorTracking: boolean;
    logLevel: string;
  };
  security: {
    enableRequestSigning: boolean;
    apiKeyEncryption: boolean;
    csrfProtection: boolean;
  };
}

// Environment-specific configuration constants
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
const DEFAULT_TIMEOUT = 30000;
const UPLOAD_TIMEOUT = 60000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];
const MAX_BACKOFF_TIME = 32000;
const BACKOFF_FACTOR = 2;

// Security headers based on best practices
const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'X-XSS-Protection': '1; mode=block',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin'
};

/**
 * Creates enhanced default API configuration with environment-specific settings
 * @returns {ApiConfig} Enhanced API configuration object
 */
const createDefaultConfig = (): ApiConfig => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    baseURL: API_BASE_URL,
    timeout: DEFAULT_TIMEOUT,
    retryPolicy: {
      maxRetries: MAX_RETRIES,
      retryDelay: RETRY_DELAY,
      retryableStatusCodes: RETRYABLE_STATUS_CODES,
      backoffFactor: BACKOFF_FACTOR,
      maxBackoffTime: MAX_BACKOFF_TIME
    },
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS
    },
    monitoring: {
      enablePerformanceTracking: isProduction,
      enableErrorTracking: true,
      logLevel: isProduction ? 'error' : 'debug'
    },
    security: {
      enableRequestSigning: isProduction,
      apiKeyEncryption: isProduction,
      csrfProtection: true
    }
  };
};

// Create axios instance with enhanced configuration
const axiosInstance = axios.create(createDefaultConfig());

// Request interceptor for authentication and monitoring
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Add request timestamp for performance tracking
    config.metadata = { startTime: new Date().getTime() };
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling and retry logic
axiosInstance.interceptors.response.use(
  (response) => {
    // Performance tracking
    if (response.config.metadata) {
      const duration = new Date().getTime() - response.config.metadata.startTime;
      console.debug(`Request to ${response.config.url} took ${duration}ms`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config;
    
    if (!config || !config.retryPolicy) {
      return Promise.reject(error);
    }

    config.retryCount = config.retryCount || 0;
    const { maxRetries, retryDelay, retryableStatusCodes, backoffFactor, maxBackoffTime } = config.retryPolicy;

    if (
      config.retryCount < maxRetries &&
      error.response &&
      retryableStatusCodes.includes(error.response.status)
    ) {
      config.retryCount += 1;
      
      // Calculate exponential backoff time
      const backoffTime = Math.min(
        retryDelay * Math.pow(backoffFactor, config.retryCount - 1),
        maxBackoffTime
      );

      // Wait for backoff time before retrying
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      return axiosInstance(config);
    }

    return Promise.reject(error);
  }
);

/**
 * Enhanced API configuration with security, monitoring, and environment-specific settings
 */
export const apiConfig = {
  ...createDefaultConfig(),
  client: axiosInstance,
  endpoints: {
    applications: API_ENDPOINTS.APPLICATIONS,
    documents: API_ENDPOINTS.DOCUMENTS,
    webhooks: API_ENDPOINTS.WEBHOOKS
  },
  // Special timeout for file upload requests
  uploadTimeout: UPLOAD_TIMEOUT,
  // Utility method for handling rate limits
  getRateLimitInfo: (headers: Record<string, string>) => ({
    remaining: parseInt(headers['x-ratelimit-remaining'] || '0', 10),
    limit: parseInt(headers['x-ratelimit-limit'] || '0', 10),
    reset: parseInt(headers['x-ratelimit-reset'] || '0', 10)
  })
};

export default apiConfig;