import React, { useCallback, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'; // v6.0.0
import { useAuth } from '../hooks/useAuth';
import DashboardLayout from '../layouts/DashboardLayout';
import { PRIVATE_ROUTES, PUBLIC_ROUTES } from '../constants/routes.constants';

/**
 * Higher-order component for role-based route protection
 * Implements security requirements from Section 7.1.2
 */
const RequireAuth = React.memo(({ 
  children, 
  allowedRoles,
  requireMFA = false 
}: {
  children: React.ReactNode;
  allowedRoles: string[];
  requireMFA?: boolean;
}) => {
  const { isAuthenticated, user, loading, validateMFA } = useAuth();
  const location = useLocation();

  // Validate MFA requirement for admin routes
  useEffect(() => {
    if (isAuthenticated && requireMFA && user?.role === 'ADMIN') {
      validateMFA();
    }
  }, [isAuthenticated, requireMFA, user?.role, validateMFA]);

  // Show loading state
  if (loading) {
    return (
      <div role="status" aria-live="polite">
        Loading authentication status...
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={PUBLIC_ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Check role-based access
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to={PUBLIC_ROUTES.FORBIDDEN} replace />;
  }

  // Render protected route
  return <>{children}</>;
});

RequireAuth.displayName = 'RequireAuth';

/**
 * Protected routes configuration with role-based access control
 * Implements authentication requirements from Section 7.1.1
 */
const PrivateRoutes: React.FC = React.memo(() => {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();

  // Memoized route access check
  const checkRouteAccess = useCallback((roles: string[], requireMFA: boolean = false) => {
    return (element: React.ReactNode) => (
      <RequireAuth allowedRoles={roles} requireMFA={requireMFA}>
        {element}
      </RequireAuth>
    );
  }, []);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div role="status" aria-live="polite">
        Verifying authentication...
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={PUBLIC_ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return (
    <DashboardLayout>
      <Routes>
        {/* Dashboard - Accessible to all authenticated users */}
        <Route 
          path={PRIVATE_ROUTES.DASHBOARD} 
          element={checkRouteAccess(['ADMIN', 'OPERATOR', 'AUDITOR'])(
            <React.Suspense fallback="Loading dashboard...">
              {/* Dashboard component would be imported here */}
            </React.Suspense>
          )} 
        />

        {/* Applications routes */}
        <Route path={PRIVATE_ROUTES.APPLICATIONS.LIST} 
          element={checkRouteAccess(['ADMIN', 'OPERATOR'])(
            <React.Suspense fallback="Loading applications...">
              {/* ApplicationList component would be imported here */}
            </React.Suspense>
          )} 
        />
        <Route path={PRIVATE_ROUTES.APPLICATIONS.DETAIL} 
          element={checkRouteAccess(['ADMIN', 'OPERATOR'])(
            <React.Suspense fallback="Loading application details...">
              {/* ApplicationDetail component would be imported here */}
            </React.Suspense>
          )} 
        />

        {/* Document routes */}
        <Route path={PRIVATE_ROUTES.DOCUMENTS.LIST} 
          element={checkRouteAccess(['ADMIN', 'OPERATOR'])(
            <React.Suspense fallback="Loading documents...">
              {/* DocumentList component would be imported here */}
            </React.Suspense>
          )} 
        />
        <Route path={PRIVATE_ROUTES.DOCUMENTS.VIEWER} 
          element={checkRouteAccess(['ADMIN', 'OPERATOR'])(
            <React.Suspense fallback="Loading document viewer...">
              {/* DocumentViewer component would be imported here */}
            </React.Suspense>
          )} 
        />

        {/* Settings routes - Admin only with MFA requirement */}
        <Route path={PRIVATE_ROUTES.SETTINGS.PROFILE} 
          element={checkRouteAccess(['ADMIN'], true)(
            <React.Suspense fallback="Loading settings...">
              {/* Settings component would be imported here */}
            </React.Suspense>
          )} 
        />
        <Route path={PRIVATE_ROUTES.SETTINGS.SECURITY.MAIN} 
          element={checkRouteAccess(['ADMIN'], true)(
            <React.Suspense fallback="Loading security settings...">
              {/* SecuritySettings component would be imported here */}
            </React.Suspense>
          )} 
        />

        {/* Webhook configuration - Admin only with MFA */}
        <Route path={PRIVATE_ROUTES.SETTINGS.WEBHOOKS.LIST} 
          element={checkRouteAccess(['ADMIN'], true)(
            <React.Suspense fallback="Loading webhooks...">
              {/* WebhookList component would be imported here */}
            </React.Suspense>
          )} 
        />

        {/* Default redirect for unmatched routes */}
        <Route path="*" element={<Navigate to={PRIVATE_ROUTES.DASHBOARD} replace />} />
      </Routes>
    </DashboardLayout>
  );
});

PrivateRoutes.displayName = 'PrivateRoutes';

export default PrivateRoutes;