import { createAsyncThunk } from '@reduxjs/toolkit'; // v1.9.5
import CryptoJS from 'crypto-js'; // v4.1.1
import { SecurityLogger } from '@security/logger'; // v1.0.0

import { AuthService } from '../../services/auth.service';
import { 
  LoginCredentials, 
  MFACredentials, 
  AuthTokens, 
  AuthUser 
} from '../../interfaces/auth.interface';

// Security logger instance for tracking authentication events
const securityLogger = new SecurityLogger({
  service: 'web-auth',
  version: '1.0.0'
});

/**
 * Interface for device information used in authentication
 */
interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  ipAddress?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

/**
 * Enhanced login action creator with security monitoring
 */
export const loginUser = createAsyncThunk(
  'auth/login',
  async (
    { credentials, deviceInfo }: { credentials: LoginCredentials; deviceInfo: DeviceInfo },
    { rejectWithValue }
  ) => {
    try {
      // Log login attempt with device info
      securityLogger.logEvent('LOGIN_ATTEMPT', {
        email: credentials.email,
        deviceFingerprint: deviceInfo.fingerprint,
        timestamp: new Date().toISOString()
      });

      // Attempt authentication
      const authService = new AuthService();
      const tokens = await authService.login(credentials);

      // Encrypt tokens before storing in Redux state
      const encryptedTokens = {
        accessToken: CryptoJS.AES.encrypt(
          tokens.accessToken,
          process.env.VITE_TOKEN_ENCRYPTION_KEY || ''
        ).toString(),
        refreshToken: CryptoJS.AES.encrypt(
          tokens.refreshToken,
          process.env.VITE_TOKEN_ENCRYPTION_KEY || ''
        ).toString(),
        expiresIn: tokens.expiresIn,
        tokenType: tokens.tokenType
      };

      // Log successful login
      securityLogger.logEvent('LOGIN_SUCCESS', {
        email: credentials.email,
        deviceFingerprint: deviceInfo.fingerprint,
        timestamp: new Date().toISOString()
      });

      return encryptedTokens;
    } catch (error: any) {
      // Log failed login attempt
      securityLogger.logEvent('LOGIN_FAILURE', {
        email: credentials.email,
        error: error.message,
        deviceFingerprint: deviceInfo.fingerprint,
        timestamp: new Date().toISOString()
      });

      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

/**
 * Enhanced MFA verification with multiple methods support
 */
export const verifyMFAToken = createAsyncThunk(
  'auth/verifyMFA',
  async (
    { 
      mfaCredentials, 
      deviceInfo 
    }: { 
      mfaCredentials: MFACredentials; 
      deviceInfo: DeviceInfo 
    },
    { rejectWithValue }
  ) => {
    try {
      // Log MFA verification attempt
      securityLogger.logEvent('MFA_ATTEMPT', {
        type: mfaCredentials.type,
        deviceFingerprint: deviceInfo.fingerprint,
        timestamp: new Date().toISOString()
      });

      const authService = new AuthService();
      const tokens = await authService.verifyMFA(mfaCredentials);

      // Encrypt tokens after successful MFA
      const encryptedTokens = {
        accessToken: CryptoJS.AES.encrypt(
          tokens.accessToken,
          process.env.VITE_TOKEN_ENCRYPTION_KEY || ''
        ).toString(),
        refreshToken: CryptoJS.AES.encrypt(
          tokens.refreshToken,
          process.env.VITE_TOKEN_ENCRYPTION_KEY || ''
        ).toString(),
        expiresIn: tokens.expiresIn,
        tokenType: tokens.tokenType
      };

      // Log successful MFA verification
      securityLogger.logEvent('MFA_SUCCESS', {
        type: mfaCredentials.type,
        deviceFingerprint: deviceInfo.fingerprint,
        timestamp: new Date().toISOString()
      });

      return encryptedTokens;
    } catch (error: any) {
      // Log failed MFA attempt
      securityLogger.logEvent('MFA_FAILURE', {
        type: mfaCredentials.type,
        error: error.message,
        deviceFingerprint: deviceInfo.fingerprint,
        timestamp: new Date().toISOString()
      });

      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

/**
 * Secure logout with token revocation
 */
export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      const authService = new AuthService();
      await authService.logout();

      // Log successful logout
      securityLogger.logEvent('LOGOUT_SUCCESS', {
        timestamp: new Date().toISOString()
      });

      return true;
    } catch (error: any) {
      // Log logout failure
      securityLogger.logEvent('LOGOUT_FAILURE', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

/**
 * Validate current session with enhanced security checks
 */
export const validateSession = createAsyncThunk(
  'auth/validateSession',
  async (_, { rejectWithValue }) => {
    try {
      const authService = new AuthService();
      const isValid = await authService.validateSession();

      if (!isValid) {
        securityLogger.logEvent('SESSION_INVALID', {
          timestamp: new Date().toISOString()
        });
        return false;
      }

      // Get current user details if session is valid
      const user = await authService.getCurrentUser();

      return user;
    } catch (error: any) {
      securityLogger.logEvent('SESSION_VALIDATION_ERROR', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

/**
 * Rotate authentication tokens for enhanced security
 */
export const rotateTokens = createAsyncThunk(
  'auth/rotateTokens',
  async (currentTokens: AuthTokens, { rejectWithValue }) => {
    try {
      const authService = new AuthService();
      const newTokens = await authService.rotateTokens();

      // Encrypt new tokens
      const encryptedTokens = {
        accessToken: CryptoJS.AES.encrypt(
          newTokens.accessToken,
          process.env.VITE_TOKEN_ENCRYPTION_KEY || ''
        ).toString(),
        refreshToken: CryptoJS.AES.encrypt(
          newTokens.refreshToken,
          process.env.VITE_TOKEN_ENCRYPTION_KEY || ''
        ).toString(),
        expiresIn: newTokens.expiresIn,
        tokenType: newTokens.tokenType
      };

      securityLogger.logEvent('TOKEN_ROTATION_SUCCESS', {
        timestamp: new Date().toISOString()
      });

      return encryptedTokens;
    } catch (error: any) {
      securityLogger.logEvent('TOKEN_ROTATION_FAILURE', {
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return rejectWithValue(error.response?.data || error.message);
    }
  }
);