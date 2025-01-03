import React, { lazy, Suspense } from 'react'; // ^18.0.0
import { Routes, Route, Navigate } from 'react-router-dom'; // ^6.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Lazy loaded components with explicit chunk names
const NotFoundPage = lazy(() => 
  import(/* webpackChunkName: "error-404" */ '../pages/Error/404')
);
const InternalServerError = lazy(() => 
  import(/* webpackChunkName: "error-500" */ '../pages/Error/500')
);

/**
 * Loading fallback component with accessibility support
 */
const LoadingFallback = () => (
  <div
    role="alert"
    aria-live="polite"
    aria-busy="true"
    style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
    }}
  >
    <span>Loading...</span>
  </div>
);

/**
 * Error fallback component for route-level errors
 */
const ErrorFallback = ({ error }: { error: Error }) => (
  <div role="alert" aria-live="assertive">
    <Navigate to="/500" state={{ error: error.message }} replace />
  </div>
);

/**
 * Public routes configuration component that handles non-authenticated routes
 * with code splitting, accessibility support, and performance optimizations.
 *
 * @component
 */
const PublicRoutes = React.memo(() => {
  // Preload critical routes
  React.useEffect(() => {
    const preloadRoutes = async () => {
      const notFoundModule = import('../pages/Error/404');
      const serverErrorModule = import('../pages/Error/500');
      await Promise.all([notFoundModule, serverErrorModule]);
    };

    // Preload after initial render
    const timeoutId = setTimeout(preloadRoutes, 1000);
    return () => clearTimeout(timeoutId);
  }, []);

  // Announce route changes to screen readers
  const announceRouteChange = (path: string) => {
    const message = `Navigated to ${path}`;
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('role', 'status');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Routes>
        <Route
          path="/404"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <NotFoundPage />
            </Suspense>
          }
        />
        <Route
          path="/500"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <InternalServerError />
            </Suspense>
          }
        />
        {/* Catch-all route for unmatched paths */}
        <Route
          path="*"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <NotFoundPage />
            </Suspense>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
});

// Display name for debugging
PublicRoutes.displayName = 'PublicRoutes';

export default PublicRoutes;