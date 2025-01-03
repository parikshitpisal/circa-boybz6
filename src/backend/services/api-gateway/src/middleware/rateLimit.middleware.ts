import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { StatusCodes } from 'http-status-codes'; // ^2.2.0
import { config } from '../config';
import { CacheService } from '../services/cache.service';
import { ApiError } from './error.middleware';
import { Logger } from '../utils/logger';

// Rate limit header constants
const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After'
} as const;

// Error messages and codes
const RATE_LIMIT_ERROR = {
  CODE: 'ERR_RATE_LIMIT_EXCEEDED',
  MESSAGE: 'API rate limit exceeded. Please try again in {retryAfter} seconds',
  BURST_MESSAGE: 'Burst rate limit exceeded. Maximum requests per minute: {burstLimit}'
} as const;

// Interface for rate limit configuration
interface RateLimitOptions {
  enabled: boolean;
  windowMs: number;
  max: number;
  burstLimit: number;
  message?: string;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  handler?: (req: Request, res: Response) => void;
  onRateLimitExceeded?: (req: Request, limit: number) => void;
}

// Interface for rate limit tracking
interface RateLimitInfo {
  count: number;
  limit: number;
  remaining: number;
  resetTime: Date;
  burstCount: number;
}

/**
 * Determines the rate limit tier based on API key and security checks
 */
const getRateLimitTier = (apiKey: string, clientIp: string): RateLimitOptions => {
  // Check for whitelisted IPs
  if (config.rateLimiting.whitelistedIPs.includes(clientIp)) {
    return {
      enabled: true,
      windowMs: config.rateLimiting.internalTier.windowSeconds * 1000,
      max: config.rateLimiting.internalTier.hourlyLimit,
      burstLimit: config.rateLimiting.internalTier.burstLimit
    };
  }

  // Check for blacklisted IPs
  if (config.rateLimiting.blacklistedIPs.includes(clientIp)) {
    return {
      enabled: true,
      windowMs: 3600000, // 1 hour
      max: 0,
      burstLimit: 0
    };
  }

  // Determine tier based on API key
  if (apiKey?.startsWith('premium_')) {
    return {
      enabled: true,
      windowMs: config.rateLimiting.premiumTier.windowSeconds * 1000,
      max: config.rateLimiting.premiumTier.hourlyLimit,
      burstLimit: config.rateLimiting.premiumTier.burstLimit
    };
  }

  // Default to standard tier
  return {
    enabled: true,
    windowMs: config.rateLimiting.standardTier.windowSeconds * 1000,
    max: config.rateLimiting.standardTier.hourlyLimit,
    burstLimit: config.rateLimiting.standardTier.burstLimit
  };
};

/**
 * Advanced Express middleware for tiered API rate limiting with security features
 */
export const rateLimitMiddleware = (
  cacheService: CacheService,
  logger: Logger
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!config.rateLimiting.enabled) {
        return next();
      }

      // Extract API key and client IP
      const apiKey = req.get('X-API-Key') || 'standard';
      const clientIp = req.ip;

      // Generate unique rate limit key
      const rateLimitKey = `${apiKey}:${clientIp}`;
      
      // Get rate limit configuration for the tier
      const tierConfig = getRateLimitTier(apiKey, clientIp);

      // Skip if rate limiting is disabled for this tier
      if (!tierConfig.enabled || tierConfig.max < 0) {
        return next();
      }

      // Get current rate limit info from cache
      const rateLimitInfo = await cacheService.getRateLimitInfo(rateLimitKey, {
        limit: tierConfig.max,
        window: tierConfig.windowMs / 1000
      });

      // Check burst limit (requests per minute)
      const burstKey = `burst:${rateLimitKey}`;
      const burstInfo = await cacheService.getRateLimitInfo(burstKey, {
        limit: tierConfig.burstLimit,
        window: 60 // 1 minute window for burst
      });

      // Set rate limit headers
      if (config.rateLimiting.rateLimitHeaders) {
        res.setHeader(RATE_LIMIT_HEADERS.LIMIT, tierConfig.max);
        res.setHeader(RATE_LIMIT_HEADERS.REMAINING, rateLimitInfo.remaining);
        res.setHeader(RATE_LIMIT_HEADERS.RESET, rateLimitInfo.reset);
      }

      // Check if burst limit exceeded
      if (burstInfo.remaining <= 0) {
        logger.warn('Burst rate limit exceeded', {
          clientIp,
          apiKey,
          burstCount: burstInfo.count,
          burstLimit: tierConfig.burstLimit
        });

        throw new ApiError(
          StatusCodes.TOO_MANY_REQUESTS,
          RATE_LIMIT_ERROR.BURST_MESSAGE.replace('{burstLimit}', String(tierConfig.burstLimit)),
          RATE_LIMIT_ERROR.CODE
        );
      }

      // Check if hourly limit exceeded
      if (rateLimitInfo.remaining <= 0) {
        logger.warn('Hourly rate limit exceeded', {
          clientIp,
          apiKey,
          count: rateLimitInfo.count,
          limit: tierConfig.max
        });

        // Set retry-after header
        res.setHeader(
          RATE_LIMIT_HEADERS.RETRY_AFTER,
          Math.ceil(rateLimitInfo.retryAfter)
        );

        throw new ApiError(
          StatusCodes.TOO_MANY_REQUESTS,
          RATE_LIMIT_ERROR.MESSAGE.replace('{retryAfter}', String(rateLimitInfo.retryAfter)),
          RATE_LIMIT_ERROR.CODE
        );
      }

      // Monitor for potential abuse (80% threshold alert)
      if (rateLimitInfo.remaining <= tierConfig.max * 0.2) {
        logger.warn('Rate limit threshold warning', {
          clientIp,
          apiKey,
          remaining: rateLimitInfo.remaining,
          limit: tierConfig.max
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

export type { RateLimitOptions, RateLimitInfo };