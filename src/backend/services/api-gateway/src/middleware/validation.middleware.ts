import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { z } from 'zod'; // ^3.22.0
import { createClient } from 'redis'; // ^4.6.0
import { validateApplication, validateDocument } from '../../../../shared/utils/validation';
import { ValidationResult } from '../../../../shared/interfaces/common';
import { ApiError } from './error.middleware';
import { loggerInstance as logger } from '../utils/logger';
import { config } from '../config';

// Validation constants
const VALIDATION_ERROR_CODE = 'ERR_VALIDATION_FAILED';
const DEFAULT_VALIDATION_OPTIONS: ValidationMiddlewareOptions = {
  strict: true,
  allowPartial: false,
  excludeFields: [],
  enableCaching: true,
  cacheTTL: 3600,
  customMessages: {},
  sanitizationRules: {}
};
const CACHE_KEY_PREFIX = 'validation:';
const MAX_VALIDATION_DEPTH = 5;
const MAX_ARRAY_LENGTH = 1000;
const MAX_STRING_LENGTH = 10000;

// Initialize Redis client for validation caching
const redisClient = createClient({
  url: config.cache.url,
  password: config.cache.password
});

redisClient.on('error', (err) => {
  logger.error('Redis client error:', { error: err.message });
});

// Connect to Redis
(async () => {
  await redisClient.connect();
})();

/**
 * Interface for validation middleware configuration options
 */
interface ValidationMiddlewareOptions {
  strict?: boolean;
  allowPartial?: boolean;
  excludeFields?: string[];
  enableCaching?: boolean;
  cacheTTL?: number;
  customMessages?: Record<string, string>;
  sanitizationRules?: Record<string, (value: any) => any>;
}

/**
 * Creates a validation middleware function with caching and performance optimization
 * @param schema - Zod schema for request validation
 * @param options - Validation middleware options
 */
export function validateRequest(
  schema: z.ZodSchema,
  options: ValidationMiddlewareOptions = {}
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  // Merge options with defaults
  const validationOptions = { ...DEFAULT_VALIDATION_OPTIONS, ...options };
  
  // Pre-compile schema for performance
  const compiledSchema = schema.compile();

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const requestData = extractRequestData(req);
      const cacheKey = generateCacheKey(requestData);

      // Check cache if enabled
      if (validationOptions.enableCaching) {
        const cachedResult = await getCachedValidation(cacheKey);
        if (cachedResult) {
          attachValidatedData(req, cachedResult.validatedData);
          return next();
        }
      }

      // Sanitize input data
      const sanitizedData = sanitizeData(requestData, validationOptions.sanitizationRules);

      // Validate data
      const validationResult = await validateData(
        compiledSchema,
        sanitizedData,
        validationOptions
      );

      if (!validationResult.isValid) {
        throw new ApiError(
          400,
          'Validation failed',
          VALIDATION_ERROR_CODE,
          formatValidationErrors(validationResult.errors, validationOptions.customMessages)
        );
      }

      // Cache successful validation result
      if (validationOptions.enableCaching) {
        await cacheValidationResult(cacheKey, validationResult, validationOptions.cacheTTL);
      }

      // Attach validated data to request
      attachValidatedData(req, validationResult.validatedData);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Specialized validation middleware for application requests
 */
export async function validateApplicationRequest(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const applicationData = req.body;
    const validationResult = await validateApplication(applicationData);

    if (!validationResult.isValid) {
      throw new ApiError(
        400,
        'Application validation failed',
        VALIDATION_ERROR_CODE,
        validationResult.errors
      );
    }

    attachValidatedData(req, applicationData);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Extracts data from request based on method and content type
 */
function extractRequestData(req: Request): unknown {
  switch (req.method) {
    case 'GET':
      return req.query;
    case 'POST':
    case 'PUT':
    case 'PATCH':
      return req.is('multipart/form-data') ? { ...req.body, ...req.files } : req.body;
    default:
      return req.body;
  }
}

/**
 * Generates cache key for validation results
 */
function generateCacheKey(data: unknown): string {
  const hash = require('crypto')
    .createHash('sha256')
    .update(JSON.stringify(data))
    .digest('hex');
  return `${CACHE_KEY_PREFIX}${hash}`;
}

/**
 * Retrieves cached validation result
 */
async function getCachedValidation(
  cacheKey: string
): Promise<ValidationResult | null> {
  try {
    const cached = await redisClient.get(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    logger.error('Cache retrieval error:', { error: error.message });
    return null;
  }
}

/**
 * Caches successful validation result
 */
async function cacheValidationResult(
  cacheKey: string,
  result: ValidationResult,
  ttl: number
): Promise<void> {
  try {
    await redisClient.set(cacheKey, JSON.stringify(result), { EX: ttl });
  } catch (error) {
    logger.error('Cache storage error:', { error: error.message });
  }
}

/**
 * Sanitizes input data based on configured rules
 */
function sanitizeData(
  data: unknown,
  rules: Record<string, (value: any) => any>
): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data as Record<string, any>)) {
    const sanitizeRule = rules[key];
    sanitized[key] = sanitizeRule ? sanitizeRule(value) : value;
  }

  return sanitized;
}

/**
 * Validates data against schema with options
 */
async function validateData(
  schema: z.ZodSchema,
  data: unknown,
  options: ValidationMiddlewareOptions
): Promise<ValidationResult> {
  try {
    const parseResult = await schema.safeParseAsync(data, {
      strict: options.strict,
      ...(options.allowPartial && { partial: true })
    });

    if (!parseResult.success) {
      return {
        isValid: false,
        errors: parseResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        validatedData: null,
        validationTimestamp: new Date()
      };
    }

    return {
      isValid: true,
      errors: [],
      validatedData: parseResult.data,
      validationTimestamp: new Date()
    };
  } catch (error) {
    logger.error('Validation error:', { error: error.message });
    throw error;
  }
}

/**
 * Formats validation errors with custom messages
 */
function formatValidationErrors(
  errors: string[],
  customMessages: Record<string, string>
): string[] {
  return errors.map(error => {
    const [path] = error.split(':');
    return customMessages[path] || error;
  });
}

/**
 * Attaches validated data to request object
 */
function attachValidatedData(req: Request, data: unknown): void {
  req.validatedData = data;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      validatedData: unknown;
    }
  }
}