import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import { loggerInstance as logger } from '../utils/logger';
import { HTTP_STATUS } from '../../../../shared/constants';

// Constants for error handling
const DEFAULT_ERROR_CODE = 'ERR_INTERNAL_SERVER';
const DEFAULT_ERROR_MESSAGE = 'An unexpected error occurred';
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'key'];
const MAX_ERROR_DETAILS_DEPTH = 3;

/**
 * Custom API Error class with enhanced security and tracking capabilities
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details: any;
  public readonly correlationId: string;
  public readonly timestamp: string;

  constructor(
    statusCode: number,
    message: string,
    code: string = DEFAULT_ERROR_CODE,
    details?: any
  ) {
    // Sanitize error message for security
    super(message);
    
    // Validate status code against HTTP_STATUS enum
    if (!Object.values(HTTP_STATUS).includes(statusCode)) {
      statusCode = HTTP_STATUS.INTERNAL_SERVER_ERROR;
    }

    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = this.sanitizeErrorDetails(details);
    this.correlationId = this.generateCorrelationId();
    this.timestamp = new Date().toISOString();

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Sanitizes error details by removing sensitive information
   */
  private sanitizeErrorDetails(details: any, depth: number = 0): any {
    if (!details || depth > MAX_ERROR_DETAILS_DEPTH) {
      return null;
    }

    if (typeof details !== 'object') {
      return details;
    }

    const sanitized: any = Array.isArray(details) ? [] : {};

    for (const [key, value] of Object.entries(details)) {
      // Skip sensitive fields
      if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
        continue;
      }

      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeErrorDetails(value, depth + 1);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Generates a unique correlation ID for error tracking
   */
  private generateCorrelationId(): string {
    return `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Express middleware for centralized error handling with security and monitoring
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Extract request context for logging
  const requestContext = {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    correlationId: req.get('x-correlation-id')
  };

  // Determine if error is an ApiError instance
  const isApiError = error instanceof ApiError;
  const statusCode = isApiError ? error.statusCode : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const errorCode = isApiError ? error.code : DEFAULT_ERROR_CODE;
  const errorMessage = isApiError ? error.message : DEFAULT_ERROR_MESSAGE;

  // Log error with context
  logger.error('API Error occurred', {
    error: {
      message: errorMessage,
      code: errorCode,
      stack: error.stack,
      details: isApiError ? error.details : undefined
    },
    request: requestContext
  });

  // Prepare error response with security considerations
  const errorResponse = {
    error: {
      message: errorMessage,
      code: errorCode,
      correlationId: isApiError ? error.correlationId : requestContext.correlationId,
      timestamp: isApiError ? error.timestamp : new Date().toISOString()
    }
  };

  // Add details only for non-500 errors and when present
  if (statusCode < 500 && isApiError && error.details) {
    errorResponse.error = {
      ...errorResponse.error,
      details: error.details
    };
  }

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Correlation-ID', errorResponse.error.correlationId);

  // Send error response
  res.status(statusCode).json(errorResponse);
};