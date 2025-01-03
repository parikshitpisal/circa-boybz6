import axios, { AxiosError } from 'axios'; // v1.4.0
import { HTTP_STATUS, ERROR_CODES } from '../constants/api.constants';
import { apiConfig } from '../config/api.config';

/**
 * Enhanced interface for API error responses
 */
export interface ApiError {
  code: string;
  message: string;
  status: number;
  details: Record<string, any>;
  timestamp: Date;
  requestId: string;
  retryable: boolean;
  validationErrors: Array<{ field: string; message: string }>;
}

/**
 * Enhanced generic interface for API responses
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  metadata: Record<string, any>;
  requestId: string;
  timestamp: Date;
}

/**
 * Interface for retry context
 */
interface RetryContext {
  attempt: number;
  maxAttempts: number;
  circuitBreakerStatus: 'closed' | 'open' | 'half-open';
  lastFailureTimestamp?: number;
}

/**
 * Interface for transform options
 */
interface TransformOptions {
  includePagination?: boolean;
  includeMetadata?: boolean;
  dataTransformer?: (data: any) => any;
}

/**
 * Creates a standardized API error object with enhanced error details
 * @param error - The original Axios error
 * @param additionalDetails - Optional additional error details
 * @returns Enhanced API error object
 */
export function createApiError(
  error: AxiosError,
  additionalDetails?: Record<string, any>
): ApiError {
  const status = error.response?.status || HTTP_STATUS.SERVER_ERROR;
  const errorResponse = error.response?.data as Record<string, any>;
  
  // Map HTTP status to application error code
  let errorCode = ERROR_CODES.SERVER_ERROR;
  switch (status) {
    case HTTP_STATUS.BAD_REQUEST:
      errorCode = ERROR_CODES.VALIDATION_ERROR;
      break;
    case HTTP_STATUS.UNAUTHORIZED:
      errorCode = ERROR_CODES.AUTHENTICATION_ERROR;
      break;
    case HTTP_STATUS.RATE_LIMIT:
      errorCode = ERROR_CODES.RATE_LIMIT_ERROR;
      break;
  }

  // Extract validation errors if present
  const validationErrors = errorResponse?.validationErrors || [];

  return {
    code: errorCode,
    message: errorResponse?.message || error.message,
    status,
    details: {
      ...errorResponse?.details,
      ...additionalDetails,
      originalError: error.message
    },
    timestamp: new Date(),
    requestId: error.response?.headers['x-request-id'] || '',
    retryable: isRetryableError(error, { attempt: 0, maxAttempts: apiConfig.retryPolicy.maxRetries, circuitBreakerStatus: 'closed' }),
    validationErrors
  };
}

/**
 * Enhanced error handler with retry logic and circuit breaker
 * @param error - The original Axios error
 * @returns Promise rejection with enhanced error
 */
export async function handleApiError(error: AxiosError): Promise<never> {
  const retryContext: RetryContext = {
    attempt: (error.config?.retryCount || 0) + 1,
    maxAttempts: apiConfig.retryPolicy.maxRetries,
    circuitBreakerStatus: getCircuitBreakerStatus(),
    lastFailureTimestamp: Date.now()
  };

  if (isRetryableError(error, retryContext)) {
    const backoffTime = calculateBackoffTime(retryContext.attempt);
    await new Promise(resolve => setTimeout(resolve, backoffTime));
    
    // Update circuit breaker metrics
    updateCircuitBreakerMetrics(error);
    
    if (error.config) {
      error.config.retryCount = retryContext.attempt;
      return axios(error.config) as Promise<never>;
    }
  }

  const enhancedError = createApiError(error, {
    retryAttempt: retryContext.attempt,
    circuitBreakerStatus: retryContext.circuitBreakerStatus
  });

  // Log error for monitoring
  console.error('API Error:', {
    ...enhancedError,
    url: error.config?.url,
    method: error.config?.method
  });

  return Promise.reject(enhancedError);
}

/**
 * Enhanced response transformer with pagination and bulk operation support
 * @param response - The raw API response
 * @param options - Transform options
 * @returns Enhanced API response
 */
export function transformResponse<T>(
  response: any,
  options: TransformOptions = {}
): ApiResponse<T> {
  const {
    includePagination = true,
    includeMetadata = true,
    dataTransformer
  } = options;

  const transformedData = dataTransformer ? dataTransformer(response.data) : response.data;

  const apiResponse: ApiResponse<T> = {
    data: transformedData,
    status: response.status,
    message: response.data?.message || '',
    pagination: includePagination ? {
      page: response.data?.meta?.page || 1,
      limit: response.data?.meta?.limit || 10,
      total: response.data?.meta?.total || 0
    } : { page: 1, limit: 10, total: 0 },
    metadata: includeMetadata ? response.data?.meta || {} : {},
    requestId: response.headers['x-request-id'] || '',
    timestamp: new Date()
  };

  return apiResponse;
}

/**
 * Enhanced retry decision maker with circuit breaker integration
 * @param error - The Axios error
 * @param context - Retry context
 * @returns Whether the error is retryable
 */
export function isRetryableError(
  error: AxiosError,
  context: RetryContext
): boolean {
  // Don't retry if circuit breaker is open
  if (context.circuitBreakerStatus === 'open') {
    return false;
  }

  // Don't retry if max attempts reached
  if (context.attempt >= context.maxAttempts) {
    return false;
  }

  // Check if status code is retryable
  const status = error.response?.status;
  const retryableStatuses = apiConfig.retryPolicy.retryableStatusCodes;
  
  if (!status || !retryableStatuses.includes(status)) {
    return false;
  }

  // Don't retry POST requests unless they're idempotent
  if (error.config?.method === 'POST' && !error.config?.headers?.['Idempotency-Key']) {
    return false;
  }

  // Special handling for rate limiting
  if (status === HTTP_STATUS.RATE_LIMIT) {
    const resetTime = parseInt(error.response?.headers['x-ratelimit-reset'] || '0', 10);
    return resetTime > 0 && Date.now() >= resetTime * 1000;
  }

  return true;
}

/**
 * Calculate exponential backoff time
 * @param attempt - Current retry attempt
 * @returns Backoff time in milliseconds
 */
function calculateBackoffTime(attempt: number): number {
  const baseDelay = apiConfig.retryPolicy.retryDelay;
  const backoffFactor = apiConfig.retryPolicy.backoffFactor;
  const maxBackoff = apiConfig.retryPolicy.maxBackoffTime;
  
  const backoffTime = baseDelay * Math.pow(backoffFactor, attempt - 1);
  return Math.min(backoffTime, maxBackoff);
}

/**
 * Get current circuit breaker status
 * @returns Circuit breaker status
 */
function getCircuitBreakerStatus(): 'closed' | 'open' | 'half-open' {
  // Implementation would typically use a circuit breaker library or service
  // This is a simplified version
  return 'closed';
}

/**
 * Update circuit breaker metrics
 * @param error - The error that occurred
 */
function updateCircuitBreakerMetrics(error: AxiosError): void {
  // Implementation would typically use a circuit breaker library or service
  // This is a placeholder for the actual implementation
  console.debug('Updating circuit breaker metrics', {
    status: error.response?.status,
    endpoint: error.config?.url
  });
}