import React, { Suspense } from 'react';
import { Route, Routes, Navigate, useLocation } from 'react-router-dom';
import SecurityMonitor from '@security/monitor'; // v1.0.0
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../layouts/AuthLayout';

// Lazy load components for code splitting
const Login = React.lazy(() => import('../pages/Auth/Login'));
const MFA = React.lazy(() => import('../pages/Auth/MFA'));

// Enhanced props interface for protected route wrapper
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  requireMFA?: boolean;
}

/**
 * Enhanced HOC that protects routes with role-based access, MFA verification,
 * and security monitoring
 */
const ProtectedRoute = React.memo<ProtectedRouteProps>(({
  children,
  requiredRole,
  requireMFA = false
}) => {
  const location = useLocation();
  const { 
    isAuthenticated, 
    user, 
    mfaRequired,
    sessionStatus,
    securityMetrics,
    validateDevice
  } = useAuth();

  const securityMonitor = new SecurityMonitor();

  // Check authentication and session validity
  React.useEffect(() => {
    const validateSession = async () => {
      try {
        // Validate device fingerprint
        const isValidDevice = await validateDevice();
        if (!isValidDevice) {
          securityMonitor.logSecurityEvent('INVALID_DEVICE_DETECTED', {
            path: location.pathname,
            timestamp: new Date()
          });
          throw new Error('Invalid device detected');
        }

        // Track session activity
        securityMonitor.trackSessionActivity({
          userId: user?.id,
          path: location.pathname,
          timestamp: new Date(),
          deviceFingerprint: securityMetrics.deviceFingerprint
        });
      } catch (error) {
        console.error('Session validation failed:', error);
      }
    };

    if (isAuthenticated) {
      validateSession();
    }
  }, [isAuthenticated, location.pathname, user?.id, validateDevice, securityMetrics.deviceFingerprint]);

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Check session expiry
  if (!sessionStatus.isActive) {
    securityMonitor.logSecurityEvent('SESSION_EXPIRED', {
      userId: user?.id,
      timestamp: new Date()
    });
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Enforce MFA requirement
  if (requireMFA && mfaRequired) {
    return <Navigate to="/auth/mfa" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (requiredRole && user?.role !== requiredRole) {
    securityMonitor.logSecurityEvent('UNAUTHORIZED_ACCESS_ATTEMPT', {
      userId: user?.id,
      requiredRole,
      actualRole: user?.role,
      path: location.pathname,
      timestamp: new Date()
    });
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
});

ProtectedRoute.displayName = 'ProtectedRoute';

/**
 * Enhanced authentication routes component with security monitoring
 * and comprehensive error handling
 */
const AuthRoutes = React.memo(() => {
  const location = useLocation();
  const securityMonitor = new SecurityMonitor();

  // Track route changes for security monitoring
  React.useEffect(() => {
    securityMonitor.trackRouteAccess({
      path: location.pathname,
      timestamp: new Date()
    });
  }, [location.pathname]);

  return (
    <AuthLayout>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          {/* Public authentication routes */}
          <Route 
            path="/login" 
            element={
              <Login />
            } 
          />
          
          {/* Protected MFA verification route */}
          <Route
            path="/mfa"
            element={
              <ProtectedRoute requireMFA={true}>
                <MFA />
              </ProtectedRoute>
            }
          />

          {/* Default redirect to login */}
          <Route
            path="*"
            element={
              <Navigate to="/auth/login" replace />
            }
          />
        </Routes>
      </Suspense>
    </AuthLayout>
  );
});

AuthRoutes.displayName = 'AuthRoutes';

export default AuthRoutes;