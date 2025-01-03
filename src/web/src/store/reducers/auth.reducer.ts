import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // v1.9.5
import { AuthState } from '../../interfaces/auth.interface';
import { loginUser, verifyMFAToken } from '../actions/auth.actions';

/**
 * Security metadata interface for tracking authentication events
 */
interface SecurityMetadata {
  loginAttempts: number;
  lastLoginAttempt: number | null;
  mfaVerifications: number;
  lastMfaAttempt: number | null;
  sessionStartTime: number | null;
  suspiciousActivities: number;
  lastActivityTimestamp: number;
}

/**
 * Initial authentication state with security tracking
 */
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: false,
  mfaRequired: false,
  error: null,
  lastActivity: Date.now(),
  securityMetadata: {
    loginAttempts: 0,
    lastLoginAttempt: null,
    mfaVerifications: 0,
    lastMfaAttempt: null,
    sessionStartTime: null,
    suspiciousActivities: 0,
    lastActivityTimestamp: Date.now()
  }
};

/**
 * Enhanced authentication slice with security monitoring
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Update last activity timestamp
     */
    updateLastActivity: (state) => {
      state.lastActivity = Date.now();
      state.securityMetadata.lastActivityTimestamp = Date.now();
    },

    /**
     * Clear authentication state on logout
     */
    logout: (state) => {
      return {
        ...initialState,
        securityMetadata: {
          ...initialState.securityMetadata,
          lastActivityTimestamp: Date.now()
        }
      };
    },

    /**
     * Reset security counters
     */
    resetSecurityMetadata: (state) => {
      state.securityMetadata = {
        ...initialState.securityMetadata,
        lastActivityTimestamp: Date.now()
      };
    },

    /**
     * Record suspicious activity
     */
    recordSuspiciousActivity: (state) => {
      state.securityMetadata.suspiciousActivities += 1;
      state.securityMetadata.lastActivityTimestamp = Date.now();
    }
  },
  extraReducers: (builder) => {
    // Login action handlers
    builder.addCase(loginUser.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.securityMetadata.loginAttempts += 1;
      state.securityMetadata.lastLoginAttempt = Date.now();
    });

    builder.addCase(loginUser.fulfilled, (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.loading = false;
      state.error = null;
      state.mfaRequired = action.payload.mfaRequired;
      state.lastActivity = Date.now();
      state.securityMetadata = {
        ...state.securityMetadata,
        loginAttempts: 0,
        sessionStartTime: Date.now(),
        lastActivityTimestamp: Date.now()
      };
    });

    builder.addCase(loginUser.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
      state.securityMetadata.lastActivityTimestamp = Date.now();

      // Check for suspicious rapid login attempts
      const timeSinceLastAttempt = state.securityMetadata.lastLoginAttempt
        ? Date.now() - state.securityMetadata.lastLoginAttempt
        : Infinity;

      if (timeSinceLastAttempt < 1000) { // Less than 1 second between attempts
        state.securityMetadata.suspiciousActivities += 1;
      }
    });

    // MFA verification handlers
    builder.addCase(verifyMFAToken.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.securityMetadata.mfaVerifications += 1;
      state.securityMetadata.lastMfaAttempt = Date.now();
    });

    builder.addCase(verifyMFAToken.fulfilled, (state) => {
      state.loading = false;
      state.mfaRequired = false;
      state.error = null;
      state.lastActivity = Date.now();
      state.securityMetadata.lastActivityTimestamp = Date.now();
    });

    builder.addCase(verifyMFAToken.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
      state.securityMetadata.lastActivityTimestamp = Date.now();

      // Check for suspicious rapid MFA attempts
      const timeSinceLastAttempt = state.securityMetadata.lastMfaAttempt
        ? Date.now() - state.securityMetadata.lastMfaAttempt
        : Infinity;

      if (timeSinceLastAttempt < 1000) { // Less than 1 second between attempts
        state.securityMetadata.suspiciousActivities += 1;
      }
    });
  }
});

// Export actions
export const {
  updateLastActivity,
  logout,
  resetSecurityMetadata,
  recordSuspiciousActivity
} = authSlice.actions;

// Export reducer
export default authSlice.reducer;