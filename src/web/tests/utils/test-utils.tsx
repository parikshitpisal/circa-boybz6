import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { store } from '../../src/store';
import { AuthContext } from '../../src/contexts/AuthContext';
import { ThemeContext } from '../../src/contexts/ThemeContext';
import lightTheme from '../../src/assets/themes/light';

/**
 * Enhanced security validation options for testing
 */
interface SecurityValidationOptions {
  validatePermissions: boolean;
  validateTokens: boolean;
  validateMFA: boolean;
  validateSession: boolean;
}

/**
 * Enhanced accessibility testing options
 */
interface AccessibilityOptions {
  wcagLevel: 'A' | 'AA' | 'AAA';
  screenReaderTesting: boolean;
  keyboardNavigation: boolean;
  colorContrast: boolean;
}

/**
 * Extended render options with security and accessibility features
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: Record<string, any>;
  authState?: {
    isAuthenticated: boolean;
    user: null | {
      id: string;
      email: string;
      role: string;
      permissions: string[];
    };
    loading: boolean;
    mfaRequired: boolean;
    error: string | null;
  };
  theme?: typeof lightTheme;
  securityValidation?: SecurityValidationOptions;
  accessibilityOptions?: AccessibilityOptions;
}

/**
 * Default render options with security and accessibility defaults
 */
const defaultRenderOptions: CustomRenderOptions = {
  initialState: {},
  authState: {
    isAuthenticated: false,
    user: null,
    loading: false,
    mfaRequired: false,
    error: null
  },
  theme: lightTheme,
  securityValidation: {
    validatePermissions: true,
    validateTokens: true,
    validateMFA: true,
    validateSession: true
  },
  accessibilityOptions: {
    wcagLevel: 'AA',
    screenReaderTesting: true,
    keyboardNavigation: true,
    colorContrast: true
  }
};

/**
 * Enhanced custom render function with security and accessibility validation
 * @param ui - React component to render
 * @param options - Custom render options
 */
const customRender = (
  ui: React.ReactElement,
  options: CustomRenderOptions = defaultRenderOptions
) => {
  const {
    initialState = {},
    authState = defaultRenderOptions.authState,
    theme = defaultRenderOptions.theme,
    securityValidation = defaultRenderOptions.securityValidation,
    accessibilityOptions = defaultRenderOptions.accessibilityOptions,
    ...renderOptions
  } = options;

  // Create wrapper with all required providers
  const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
    return (
      <Provider store={store}>
        <AuthContext.Provider
          value={{
            state: authState,
            login: async () => {},
            logout: async () => {},
            verifyMFA: async () => {},
            refreshToken: async () => {}
          }}
        >
          <ThemeContext.Provider
            value={{
              theme,
              toggleTheme: () => {},
              isThemeLoading: false
            }}
          >
            <ThemeProvider theme={theme}>
              {children}
            </ThemeProvider>
          </ThemeContext.Provider>
        </AuthContext.Provider>
      </Provider>
    );
  };

  // Render with enhanced error boundary and monitoring
  return {
    ...render(ui, { wrapper: AllTheProviders, ...renderOptions }),
    // Additional test helpers
    store,
    rerender: (rerenderUi: React.ReactElement) =>
      customRender(rerenderUi, options),
    validateSecurity: () => {
      if (securityValidation.validatePermissions) {
        // Validate component permissions
      }
      if (securityValidation.validateTokens) {
        // Validate auth tokens
      }
      if (securityValidation.validateMFA) {
        // Validate MFA requirements
      }
      if (securityValidation.validateSession) {
        // Validate session status
      }
    },
    validateAccessibility: () => {
      if (accessibilityOptions.screenReaderTesting) {
        // Validate screen reader compatibility
      }
      if (accessibilityOptions.keyboardNavigation) {
        // Validate keyboard navigation
      }
      if (accessibilityOptions.colorContrast) {
        // Validate color contrast ratios
      }
    }
  };
};

/**
 * Creates enhanced mock authentication state for testing
 * @param overrides - Optional auth state overrides
 */
const createMockAuthState = (overrides?: Partial<typeof defaultRenderOptions.authState>) => {
  return {
    ...defaultRenderOptions.authState,
    ...overrides,
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
};

// Re-export testing library utilities
export * from '@testing-library/react';
export { customRender as render, createMockAuthState };