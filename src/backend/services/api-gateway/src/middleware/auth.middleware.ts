import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // ^2.4.1
import winston from 'winston'; // ^3.8.0
import { AuthService } from '../services/auth.service';
import { errorHandler } from './error.middleware';
import { HTTP_STATUS, SECURITY_CONFIG } from '../../../../shared/constants';

// Enhanced request interface with security context
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    mfaEnabled: boolean;
    lastLogin: number;
  };
  deviceFingerprint?: string;
  securityContext?: {
    ipAddress: string;
    userAgent: string;
    timestamp: number;
    sessionId: string;
  };
}

// Error messages for authentication failures
const AUTH_ERROR_MESSAGES = {
  TOKEN_MISSING: 'Authentication token is required',
  TOKEN_INVALID: 'Invalid authentication token',
  TOKEN_EXPIRED: 'Authentication token has expired',
  TOKEN_BLACKLISTED: 'Token has been revoked',
  UNAUTHORIZED: 'Unauthorized access',
  MFA_REQUIRED: 'MFA verification required',
  MFA_INVALID: 'Invalid MFA token',
  DEVICE_UNRECOGNIZED: 'Unrecognized device detected',
  RATE_LIMIT_EXCEEDED: 'Too many authentication attempts'
};

// Rate limiter configuration for authentication attempts
const authRateLimiter = new RateLimiterMemory({
  points: 5, // Number of attempts
  duration: 60, // Per minute
  blockDuration: 300 // 5 minutes block
});

/**
 * Enhanced JWT authentication middleware with comprehensive security checks
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error(AUTH_ERROR_MESSAGES.TOKEN_MISSING);
    }

    const token = authHeader.split(' ')[1];
    const authService = new AuthService(req.app.locals.cacheService);

    // Apply rate limiting
    try {
      await authRateLimiter.consume(req.ip);
    } catch (error) {
      throw new Error(AUTH_ERROR_MESSAGES.RATE_LIMIT_EXCEEDED);
    }

    // Verify token and extract user payload
    const userPayload = await authService.verifyToken(token);

    // Check device fingerprint if available
    const deviceFingerprint = req.headers['x-device-fingerprint'] as string;
    if (deviceFingerprint) {
      const isValidDevice = await authService.validateDeviceFingerprint(
        userPayload.id,
        deviceFingerprint
      );
      if (!isValidDevice) {
        throw new Error(AUTH_ERROR_MESSAGES.DEVICE_UNRECOGNIZED);
      }
    }

    // Enhance request with security context
    req.user = userPayload;
    req.deviceFingerprint = deviceFingerprint;
    req.securityContext = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      timestamp: Date.now(),
      sessionId: req.headers['x-session-id'] as string
    };

    // Log successful authentication
    winston.info('Authentication successful', {
      userId: userPayload.id,
      ipAddress: req.ip,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    errorHandler(error, req, res, next);
  }
};

/**
 * Role-based authorization middleware with granular permission checking
 */
export const authorize = (allowedRoles: string[], requiredPermissions: string[] = []) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new Error(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
      }

      // Check role authorization
      if (!allowedRoles.includes(req.user.role)) {
        throw new Error(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
      }

      // Check granular permissions if specified
      if (requiredPermissions.length > 0) {
        const hasAllPermissions = requiredPermissions.every(permission =>
          req.user!.permissions.includes(permission)
        );
        if (!hasAllPermissions) {
          throw new Error(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
        }
      }

      // Log authorization success
      winston.info('Authorization successful', {
        userId: req.user.id,
        role: req.user.role,
        permissions: requiredPermissions,
        timestamp: new Date().toISOString()
      });

      next();
    } catch (error) {
      errorHandler(error, req, res, next);
    }
  };
};

/**
 * Enhanced MFA verification middleware with additional security features
 */
export const verifyMFA = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      throw new Error(AUTH_ERROR_MESSAGES.UNAUTHORIZED);
    }

    // Check if MFA is required for user
    if (!req.user.mfaEnabled) {
      return next();
    }

    const mfaToken = req.headers['x-mfa-token'] as string;
    if (!mfaToken) {
      throw new Error(AUTH_ERROR_MESSAGES.MFA_REQUIRED);
    }

    const authService = new AuthService(req.app.locals.cacheService);
    const isValidMFA = await authService.verifyMFAToken(req.user.id, mfaToken);

    if (!isValidMFA) {
      throw new Error(AUTH_ERROR_MESSAGES.MFA_INVALID);
    }

    // Log successful MFA verification
    winston.info('MFA verification successful', {
      userId: req.user.id,
      timestamp: new Date().toISOString()
    });

    next();
  } catch (error) {
    errorHandler(error, req, res, next);
  }
};

export default {
  authenticate,
  authorize,
  verifyMFA
};