import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { RouteAnnouncer } from '@reach/router';
import { useAuth } from '../hooks/useAuth';

// Lazy load route components for code splitting
const AuthRoutes = React.lazy(() => import('./AuthRoutes'));
const PrivateRoutes = React.lazy(() => import('./PrivateRoutes'));
const PublicRoutes = React.lazy(() => import('./PublicRoutes'));

/**
 * Loading fallback component with accessibility support
 */
const LoadingFallback = () => (
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
    Loading...
  </div>
);

/**
 * Error boundary fallback component
 */
const ErrorFallback = ({ error }: { error: Error }) => (
  <div 
    role="alert" 
    aria-live="assertive"
    style={{
      padding: '20px',
      color: 'red',
      textAlign: 'center'
    }}
  >
    <h2>Application Error</h2>
    <pre>{error.message}</pre>
  </div>
);

/**
 * Route change monitor for security and accessibility
 */
const RouteMonitor = () => {
  const location = useLocation();
  const { isAuthenticated, sessionStatus, refreshSession } = useAuth();

  // Monitor route changes for security and session management
  useEffect(() => {
    const monitorRoute = async () => {
      if (isAuthenticated) {
        // Validate session on route change
        if (sessionStatus.requiresReauthentication) {
          await refreshSession();
        }

        // Log route access for security audit
        console.info('Route access:', {
          path: location.pathname,
          authenticated: isAuthenticated,
          timestamp: new Date()
        });
      }
    };

    monitorRoute();
  }, [location, isAuthenticated, sessionStatus, refreshSession]);

  return null;
};

/**
 * Root routing configuration component implementing secure authentication,
 * role-based access control, and accessibility features
 */
const AppRoutes = React.memo(() => {
  const { isAuthenticated, loading } = useAuth();

  // Show initial loading state
  if (loading) {
    return <LoadingFallback />;
  }

  return (
    <BrowserRouter>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <RouteMonitor />
        <RouteAnnouncer />
        
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Authentication routes */}
            <Route 
              path="/auth/*" 
              element={<AuthRoutes />} 
            />

            {/* Protected application routes */}
            <Route
              path="/app/*"
              element={<PrivateRoutes />}
            />

            {/* Public and error routes */}
            <Route 
              path="/*" 
              element={<PublicRoutes />} 
            />

            {/* Default redirect based on auth state */}
            <Route
              path="/"
              element={
                isAuthenticated ? (
                  <Navigate to="/app/dashboard" replace />
                ) : (
                  <Navigate to="/auth/login" replace />
                )
              }
            />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
});

// Display name for debugging
AppRoutes.displayName = 'AppRoutes';

export default AppRoutes;