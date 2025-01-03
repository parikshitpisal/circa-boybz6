/**
 * Authentication interfaces for the AI-Driven Application Intake Platform
 * Implements authentication and authorization requirements from Section 7.1
 * @version 1.0.0
 */

/**
 * Available user roles with strictly defined access levels
 * Based on Authorization Matrix from Section 7.1.2
 */
export enum UserRole {
  ADMIN = 'ADMIN',        // Full system access
  OPERATOR = 'OPERATOR',  // Limited document and data access
  AUDITOR = 'AUDITOR',    // Read-only access
  API_USER = 'API_USER'   // Programmatic access only
}

/**
 * Login credentials interface for initial authentication
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Multi-Factor Authentication (MFA) credentials
 * Supports both Time-based One-Time Password (TOTP) and backup codes
 */
export interface MFACredentials {
  token: string;           // TOTP code or backup code
  backupCode?: string;     // Optional backup code
  type: 'totp' | 'backup'; // MFA method being used
}

/**
 * JWT Authentication tokens interface
 * Implements OAuth 2.0 + JWT requirements from Section 7.1.1
 */
export interface AuthTokens {
  accessToken: string;     // JWT access token (1-hour expiry)
  refreshToken: string;    // JWT refresh token (24-hour expiry)
  expiresIn: number;       // Token expiration time in seconds
  tokenType: 'Bearer';     // Token type (always Bearer)
}

/**
 * Authenticated user data interface
 * Contains user profile and authorization details
 */
export interface AuthUser {
  id: string;             // Unique user identifier
  email: string;          // User email address
  role: UserRole;         // User role for access control
  mfaEnabled: boolean;    // MFA status flag
  lastLogin: Date;        // Last successful login timestamp
  permissions: string[];  // Granular permission flags
}

/**
 * Global authentication state interface
 * Used for managing authentication status throughout the application
 */
export interface AuthState {
  isAuthenticated: boolean;      // Authentication status
  user: AuthUser | null;         // Current user data
  loading: boolean;              // Authentication process status
  mfaRequired: boolean;          // MFA verification requirement flag
  error: string | null;          // Authentication error message
}