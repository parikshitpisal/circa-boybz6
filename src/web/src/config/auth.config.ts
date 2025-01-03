/**
 * Authentication Configuration
 * Implements comprehensive authentication settings based on Section 7.1 of Technical Specifications
 * @version 1.0.0
 */

import { AuthTokens } from '../interfaces/auth.interface';

/**
 * Authentication endpoints configuration
 */
interface AuthEndpoints {
  login: string;
  logout: string;
  refresh: string;
  mfa: {
    verify: string;
    setup: string;
    backup: string;
    disable: string;
  };
  user: string;
  password: {
    reset: string;
    change: string;
  };
}

/**
 * JWT token configuration interface
 */
interface TokenConfig {
  accessTokenExpiry: number;
  refreshTokenExpiry: number;
  tokenType: string;
  storageKey: string;
  headerKey: string;
  jwtConfig: {
    algorithm: string;
    issuer: string;
    audience: string;
    rotationInterval: number;
  };
}

/**
 * Multi-factor authentication configuration interface
 */
interface MFAConfig {
  enabled: boolean;
  requiredForAdmin: boolean;
  methods: string[];
  tokenLength: number;
  tokenExpiry: number;
  backupCodesCount: number;
  maxAttempts: number;
  lockoutDuration: number;
  recoveryOptions: {
    enabled: boolean;
    methods: string[];
    requireApproval: boolean;
  };
}

/**
 * Security configuration interface
 */
interface SecurityConfig {
  maxLoginAttempts: number;
  lockoutDuration: number;
  sessionTimeout: number;
  requirePasswordChange: number;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    preventReuse: number;
    expiryDays: number;
  };
  monitoring: {
    logFailedAttempts: boolean;
    alertThreshold: number;
    suspiciousIpThreshold: number;
  };
}

/**
 * Main authentication configuration interface
 */
interface AuthConfigType {
  authEndpoints: AuthEndpoints;
  tokenConfig: TokenConfig;
  mfaConfig: MFAConfig;
  securityConfig: SecurityConfig;
}

/**
 * Comprehensive authentication configuration
 * Implements security requirements from Section 7.1 and 7.3
 */
export const authConfig: AuthConfigType = {
  authEndpoints: {
    login: '/api/v1/auth/login',
    logout: '/api/v1/auth/logout',
    refresh: '/api/v1/auth/refresh',
    mfa: {
      verify: '/api/v1/auth/mfa/verify',
      setup: '/api/v1/auth/mfa/setup',
      backup: '/api/v1/auth/mfa/backup',
      disable: '/api/v1/auth/mfa/disable'
    },
    user: '/api/v1/auth/user',
    password: {
      reset: '/api/v1/auth/password/reset',
      change: '/api/v1/auth/password/change'
    }
  },

  tokenConfig: {
    // 1 hour access token expiry
    accessTokenExpiry: 3600,
    // 24 hour refresh token expiry
    refreshTokenExpiry: 86400,
    tokenType: 'Bearer',
    storageKey: 'auth_tokens',
    headerKey: 'Authorization',
    jwtConfig: {
      algorithm: 'RS256',
      issuer: 'dollar-funding-auth',
      audience: 'dollar-funding-api',
      // 12 hour key rotation interval
      rotationInterval: 43200
    }
  },

  mfaConfig: {
    enabled: true,
    requiredForAdmin: true,
    methods: ['totp', 'email', 'sms'],
    tokenLength: 6,
    // 5 minute token expiry
    tokenExpiry: 300,
    backupCodesCount: 10,
    maxAttempts: 3,
    // 15 minute lockout after max attempts
    lockoutDuration: 900,
    recoveryOptions: {
      enabled: true,
      methods: ['security_questions', 'backup_codes'],
      requireApproval: true
    }
  },

  securityConfig: {
    maxLoginAttempts: 5,
    // 5 minute lockout duration
    lockoutDuration: 300,
    // 30 minute session timeout
    sessionTimeout: 1800,
    // Force password change every 90 days
    requirePasswordChange: 90,
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true,
      // Prevent reuse of last 5 passwords
      preventReuse: 5,
      // Password expires after 90 days
      expiryDays: 90
    },
    monitoring: {
      logFailedAttempts: true,
      // Alert after 3 failed attempts
      alertThreshold: 3,
      // Flag IP after 10 suspicious activities
      suspiciousIpThreshold: 10
    }
  }
};