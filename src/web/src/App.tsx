import React, { Suspense, useEffect } from 'react';
import { CssBaseline } from '@mui/material'; // v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { withPerformanceMonitor } from '@sentry/react'; // v7.0.0

import AppRoutes from './routes';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';

/**
 * Error fallback component with accessibility support
 */
const ErrorFallback = React.memo(({ error }: { error: Error }) => (
  <div
    role="alert"
    aria-live="assertive"
    style={{
      padding: '20px',
      margin: '20px',
      border: '1px solid #ff0000',
      borderRadius: '4px',
      color: '#ff0000'
    }}
  >
    <h2>Application Error</h2>
    <pre>{error.message}</pre>
  </div>
));

ErrorFallback.displayName = 'ErrorFallback';

/**
 * Loading fallback component with accessibility support
 */
const LoadingFallback = React.memo(() => (
  <div
    role="status"
    aria-live="polite"
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh'
    }}
  >
    <span>Loading application...</span>
  </div>
));

LoadingFallback.displayName = 'LoadingFallback';

/**
 * Root application component that provides theme and authentication context providers,
 * configures the main routing structure, implements error boundaries, and ensures
 * accessibility compliance.
 */
const App = React.memo(() => {
  // Handle uncaught errors
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('Application error:', error, errorInfo);
    // Log to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Sentry.captureException(error);
    }
  };

  // Setup global error handler
  useEffect(() => {
    window.onerror = (message, source, lineno, colno, error) => {
      handleError(error || new Error(String(message)), {
        componentStack: `${source}:${lineno}:${colno}`
      });
      return true;
    };

    return () => {
      window.onerror = null;
    };
  }, []);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={handleError}
    >
      <ThemeProvider>
        <AuthProvider>
          <CssBaseline />
          <Suspense fallback={<LoadingFallback />}>
            <div
              id="app-root"
              role="application"
              aria-label="AI-Driven Application Intake Platform"
            >
              <AppRoutes />
            </div>
          </Suspense>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
});

// Display name for debugging
App.displayName = 'App';

// Enhance with performance monitoring in production
const EnhancedApp = process.env.NODE_ENV === 'production'
  ? withPerformanceMonitor(App)
  : App;

export default EnhancedApp;