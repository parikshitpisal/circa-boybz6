import { useContext } from 'react'; // v18.0.0
import { AuthContext } from '../contexts/AuthContext';
import { AuthState } from '../interfaces/auth.interface';
import { authConfig } from '../config/auth.config';

/**
 * Enhanced security metrics interface for monitoring authentication activity
 */
interface SecurityMetrics {
  failedAttempts: number;
  lastActivity: Date;
  deviceFingerprint: string;
  sessionExpiry: Date;
  mfaStatus: 'required' | 'verified' | 'disabled';
  securityEvents: Array<{
    type: string;
    timestamp: Date;
    details: Record<string, any>;
  }>;
}

/**
 * Session status interface for tracking user session state
 */
interface SessionStatus {
  isActive: boolean;
  lastActivity: Date;
  timeUntilExpiry: number;
  requiresReauthentication: boolean;
}

/**
 * Enhanced useAuth hook with comprehensive security features
 * Implements authentication requirements from Section 7.1 and security monitoring from Section 7.3
 * @returns Authentication context with enhanced security features
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  const { state, login, logout, verifyMFA, refreshToken } = context;

  /**
   * Calculate current session status with security checks
   */
  const getSessionStatus = (): SessionStatus => {
    const now = new Date();
    const lastActivity = state.lastActivity || now;
    const sessionTimeout = authConfig.securityConfig.sessionTimeout * 1000;
    const timeUntilExpiry = Math.max(0, sessionTimeout - (now.getTime() - lastActivity.getTime()));
    
    return {
      isActive: state.isAuthenticated && timeUntilExpiry > 0,
      lastActivity,
      timeUntilExpiry,
      requiresReauthentication: timeUntilExpiry <= 300000 // 5 minutes
    };
  };

  /**
   * Get current security metrics for monitoring
   */
  const getSecurityMetrics = (): SecurityMetrics => {
    const sessionExpiry = new Date(state.lastActivity?.getTime() + authConfig.securityConfig.sessionTimeout * 1000);
    
    return {
      failedAttempts: state.failedAttempts || 0,
      lastActivity: state.lastActivity || new Date(),
      deviceFingerprint: state.deviceFingerprint || '',
      sessionExpiry,
      mfaStatus: state.mfaRequired ? 'required' : state.user?.mfaEnabled ? 'verified' : 'disabled',
      securityEvents: []
    };
  };

  /**
   * Validate current device fingerprint
   */
  const validateDevice = async (): Promise<boolean> => {
    if (!state.deviceFingerprint) {
      return false;
    }

    // Compare current fingerprint with stored value
    const currentFingerprint = await generateDeviceFingerprint();
    return currentFingerprint === state.deviceFingerprint;
  };

  /**
   * Generate device fingerprint for security tracking
   */
  const generateDeviceFingerprint = async (): Promise<string> => {
    const deviceData = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    // Generate hash of device data
    const deviceString = JSON.stringify(deviceData);
    const encoder = new TextEncoder();
    const data = encoder.encode(deviceString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  /**
   * Refresh current session with security validation
   */
  const refreshSession = async (): Promise<void> => {
    const sessionStatus = getSessionStatus();
    
    if (!sessionStatus.isActive) {
      await logout();
      return;
    }

    if (!(await validateDevice())) {
      await logout();
      throw new Error('Invalid device fingerprint detected');
    }

    await refreshToken();
  };

  return {
    // Authentication state
    isAuthenticated: state.isAuthenticated,
    user: state.user,
    loading: state.loading,
    mfaRequired: state.mfaRequired,
    error: state.error,

    // Authentication methods
    login,
    logout,
    verifyMFA,
    refreshSession,

    // Security features
    sessionStatus: getSessionStatus(),
    securityMetrics: getSecurityMetrics(),
    validateDevice,

    // Session management
    refreshToken,
    lastActivity: state.lastActivity
  };
}

export default useAuth;