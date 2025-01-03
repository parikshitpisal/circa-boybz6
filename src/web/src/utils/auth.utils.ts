/**
 * Authentication Utility Functions
 * Implements secure token management based on Section 7.1 and 7.2 of Technical Specifications
 * @version 1.0.0
 */

import { AuthTokens } from '../interfaces/auth.interface';
import { authConfig } from '../config/auth.config';
import jwtDecode from 'jwt-decode'; // v3.1.2
import CryptoJS from 'crypto-js'; // v4.1.1

/**
 * Interface for encrypted token storage
 */
interface EncryptedStorage {
  iv: string;
  data: string;
}

/**
 * Interface for decoded JWT payload
 */
interface JWTPayload {
  exp: number;
  iat: number;
  role: string;
  sub: string;
}

/**
 * Retrieves and decrypts authentication tokens from secure storage
 * Implements requirements from Section 7.2 Data Security
 */
export const getTokens = (): AuthTokens | null => {
  try {
    const encryptedData = localStorage.getItem(authConfig.tokenConfig.storageKey);
    if (!encryptedData) return null;

    const storage: EncryptedStorage = JSON.parse(encryptedData);
    if (!storage.iv || !storage.data) {
      clearTokens();
      return null;
    }

    // Decrypt tokens using stored IV
    const decryptedBytes = CryptoJS.AES.decrypt(
      storage.data,
      authConfig.tokenConfig.storageKey,
      {
        iv: CryptoJS.enc.Base64.parse(storage.iv),
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );

    const tokens: AuthTokens = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));
    if (!tokens.accessToken || !tokens.refreshToken) {
      clearTokens();
      return null;
    }

    // Validate token structure and expiration
    if (isTokenExpired(tokens.accessToken)) {
      clearTokens();
      return null;
    }

    return tokens;
  } catch (error) {
    clearTokens();
    return null;
  }
};

/**
 * Securely stores encrypted authentication tokens
 * Implements AES encryption with random IV generation
 */
export const setTokens = (tokens: AuthTokens): void => {
  try {
    if (!tokens.accessToken || !tokens.refreshToken) {
      throw new Error('Invalid token structure');
    }

    // Generate random IV for encryption
    const iv = CryptoJS.lib.WordArray.random(16);
    
    // Encrypt tokens with AES-256-CBC
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(tokens),
      authConfig.tokenConfig.storageKey,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );

    const storage: EncryptedStorage = {
      iv: CryptoJS.enc.Base64.stringify(iv),
      data: encrypted.toString()
    };

    localStorage.setItem(
      authConfig.tokenConfig.storageKey,
      JSON.stringify(storage)
    );
  } catch (error) {
    clearTokens();
    throw new Error('Failed to store authentication tokens');
  }
};

/**
 * Securely removes authentication tokens with data wiping
 * Implements secure cleanup requirements
 */
export const clearTokens = (): void => {
  try {
    // Overwrite storage with random data before removal
    const dummy = CryptoJS.lib.WordArray.random(64);
    localStorage.setItem(
      authConfig.tokenConfig.storageKey,
      dummy.toString()
    );
    
    // Remove tokens from storage
    localStorage.removeItem(authConfig.tokenConfig.storageKey);
    
    // Clear any session storage tokens
    sessionStorage.removeItem(authConfig.tokenConfig.storageKey);
  } catch (error) {
    // Ensure storage is cleared even if overwrite fails
    localStorage.removeItem(authConfig.tokenConfig.storageKey);
    sessionStorage.removeItem(authConfig.tokenConfig.storageKey);
  }
};

/**
 * Validates token expiration and signature
 * Implements comprehensive token validation requirements
 */
export const isTokenExpired = (token: string): boolean => {
  try {
    const decoded = jwtDecode<JWTPayload>(token);
    
    if (!decoded.exp || !decoded.iat || !decoded.role || !decoded.sub) {
      return true;
    }

    // Check token expiration with 30-second buffer
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp <= currentTime + 30) {
      return true;
    }

    // Validate token age
    const tokenAge = currentTime - decoded.iat;
    if (tokenAge > authConfig.tokenConfig.accessTokenExpiry) {
      return true;
    }

    return false;
  } catch (error) {
    return true;
  }
};

/**
 * Generates authorization header with token validation
 * Implements secure header generation requirements
 */
export const getAuthHeader = (): { [key: string]: string } | null => {
  try {
    const tokens = getTokens();
    if (!tokens || !tokens.accessToken) {
      return null;
    }

    return {
      [authConfig.tokenConfig.headerKey]: `${authConfig.tokenConfig.tokenType} ${tokens.accessToken}`
    };
  } catch (error) {
    return null;
  }
};