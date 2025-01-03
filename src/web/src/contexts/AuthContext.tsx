import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import AuthService from '../services/auth.service';
import { AuthState, LoginCredentials } from '../interfaces/auth.interface';

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 1800000;
// Maximum failed login attempts before lockout
const MAX_FAILED_ATTEMPTS = 5;

/**
 * Authentication context interface with enhanced security features
 */
interface AuthContextType {
  state: AuthState;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  verifyMFA: (token: string) => Promise<void>;
  refreshToken: () => Promise<void>;
}

/**
 * Create authentication context with undefined initial value
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Enhanced authentication provider with security monitoring and MFA support
 */
export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // Initialize authentication state
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
    mfaRequired: false,
    failedAttempts: 0,
    lastActivity: new Date(),
    error: null
  });

  // Initialize auth service instance
  const authService = useMemo(() => new AuthService(), []);

  /**
   * Session activity monitoring hook
   */
  const useSessionMonitor = useCallback(() => {
    useEffect(() => {
      if (!state.isAuthenticated) return;

      let sessionTimer: NodeJS.Timeout;
      let activityTimer: NodeJS.Timeout;

      const handleActivity = () => {
        setState(prev => ({
          ...prev,
          lastActivity: new Date()
        }));
      };

      const checkSession = () => {
        const now = new Date().getTime();
        const lastActivity = state.lastActivity.getTime();
        
        if (now - lastActivity > SESSION_TIMEOUT) {
          authService.logout();
          setState(prev => ({
            ...prev,
            isAuthenticated: false,
            error: 'Session expired due to inactivity'
          }));
        }
      };

      // Set up activity listeners
      window.addEventListener('mousemove', handleActivity);
      window.addEventListener('keypress', handleActivity);
      window.addEventListener('click', handleActivity);

      // Set up session monitoring
      sessionTimer = setInterval(checkSession, 60000); // Check every minute
      activityTimer = setInterval(handleActivity, 300000); // Update activity every 5 minutes

      return () => {
        window.removeEventListener('mousemove', handleActivity);
        window.removeEventListener('keypress', handleActivity);
        window.removeEventListener('click', handleActivity);
        clearInterval(sessionTimer);
        clearInterval(activityTimer);
      };
    }, [state.isAuthenticated]);
  }, [authService]);

  /**
   * Enhanced login handler with security measures
   */
  const login = useCallback(async (credentials: LoginCredentials) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      if (state.failedAttempts >= MAX_FAILED_ATTEMPTS) {
        throw new Error('Account locked due to too many failed attempts');
      }

      const response = await authService.login(credentials);

      if (response.mfaRequired) {
        setState(prev => ({
          ...prev,
          mfaRequired: true,
          loading: false,
          failedAttempts: 0
        }));
      } else {
        const user = await authService.getCurrentUser();
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          user,
          mfaRequired: false,
          loading: false,
          failedAttempts: 0,
          lastActivity: new Date()
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        failedAttempts: prev.failedAttempts + 1,
        error: error instanceof Error ? error.message : 'Login failed'
      }));
    }
  }, [authService, state.failedAttempts]);

  /**
   * Enhanced MFA verification handler
   */
  const verifyMFA = useCallback(async (token: string) => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      await authService.verifyMFA({ token, type: 'totp' });
      const user = await authService.getCurrentUser();
      
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        user,
        mfaRequired: false,
        loading: false,
        lastActivity: new Date()
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'MFA verification failed'
      }));
    }
  }, [authService]);

  /**
   * Secure logout handler
   */
  const logout = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      await authService.logout();
    } finally {
      setState({
        isAuthenticated: false,
        user: null,
        loading: false,
        mfaRequired: false,
        failedAttempts: 0,
        lastActivity: new Date(),
        error: null
      });
    }
  }, [authService]);

  /**
   * Token refresh handler with error handling
   */
  const refreshToken = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      await authService.refreshToken();
      const user = await authService.getCurrentUser();
      setState(prev => ({
        ...prev,
        isAuthenticated: true,
        user,
        loading: false,
        lastActivity: new Date()
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Token refresh failed'
      }));
    }
  }, [authService]);

  // Initialize session monitoring
  useSessionMonitor();

  // Set up token refresh interval
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const refreshInterval = setInterval(refreshToken, 3300000); // Refresh every 55 minutes
    return () => clearInterval(refreshInterval);
  }, [state.isAuthenticated, refreshToken]);

  // Validate session on mount
  useEffect(() => {
    const validateSession = async () => {
      try {
        const user = await authService.getCurrentUser();
        setState(prev => ({
          ...prev,
          isAuthenticated: true,
          user,
          loading: false,
          lastActivity: new Date()
        }));
      } catch {
        setState(prev => ({
          ...prev,
          isAuthenticated: false,
          user: null,
          loading: false
        }));
      }
    };

    validateSession();
  }, [authService]);

  // Memoized context value
  const contextValue = useMemo(() => ({
    state,
    login,
    logout,
    verifyMFA,
    refreshToken
  }), [state, login, logout, verifyMFA, refreshToken]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};