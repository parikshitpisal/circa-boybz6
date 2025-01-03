import React, { Suspense } from 'react'; // ^18.0.0
import { Box, Container, Grid } from '@mui/material'; // ^5.0.0
import { styled, useTheme } from '@mui/material/styles'; // ^5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import Layout from '../components/common/Layout/Layout';
import Card from '../components/common/Card/Card';

/**
 * Props interface for AuthLayout component with accessibility and security features
 */
interface AuthLayoutProps {
  /**
   * Authentication form content to be rendered
   */
  children: React.ReactNode;

  /**
   * Maximum width constraint for auth form container
   * @default 'sm'
   */
  maxWidth?: 'xs' | 'sm';

  /**
   * Card elevation level for visual hierarchy
   * @default 2
   */
  elevation?: number;

  /**
   * ARIA role for accessibility
   * @default 'form'
   */
  role?: string;

  /**
   * Accessibility label for the layout
   */
  ariaLabel?: string;
}

/**
 * Styled container component for authentication layout with responsive design
 */
const StyledAuthContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '100vh',
  padding: theme.spacing(3),
  transition: 'padding 0.3s ease',
  backgroundColor: theme.palette.background.default,
  
  // Responsive padding adjustments
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(2),
  },
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(1.5),
  },
}));

/**
 * Styled card component for authentication forms with enhanced security features
 */
const StyledAuthCard = styled(Card)(({ theme }) => ({
  width: '100%',
  maxWidth: '400px',
  padding: theme.spacing(4),
  borderRadius: '8px',
  transition: 'all 0.3s ease',
  
  // Enhanced focus states for security
  '&:focus-within': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },

  // Responsive adjustments
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(3),
  },

  // High contrast mode support
  '@media (forced-colors: active)': {
    borderColor: 'CanvasText',
  },
}));

/**
 * Error fallback component for authentication errors
 */
const AuthErrorFallback = ({ error }: { error: Error }) => (
  <Box
    role="alert"
    aria-live="assertive"
    sx={{
      p: 3,
      color: 'error.main',
      textAlign: 'center',
    }}
  >
    <h2>Authentication Error</h2>
    <p>{error.message}</p>
  </Box>
);

/**
 * Loading fallback component for authentication forms
 */
const AuthLoadingFallback = () => (
  <Box
    role="status"
    aria-live="polite"
    sx={{
      p: 3,
      textAlign: 'center',
    }}
  >
    <p>Loading authentication form...</p>
  </Box>
);

/**
 * Enhanced layout component for authentication pages with improved security,
 * accessibility, and responsive features. Implements OAuth 2.0 + JWT flows
 * and MFA screen support.
 *
 * @component
 */
const AuthLayout = React.memo<AuthLayoutProps>(({
  children,
  maxWidth = 'sm',
  elevation = 2,
  role = 'form',
  ariaLabel = 'Authentication form',
}) => {
  const theme = useTheme();

  return (
    <Layout maxWidth={maxWidth}>
      <ErrorBoundary FallbackComponent={AuthErrorFallback}>
        <StyledAuthContainer
          maxWidth={false}
          component="main"
          role="main"
          aria-label="Authentication page"
        >
          <Grid
            container
            justifyContent="center"
            alignItems="center"
            sx={{ minHeight: '100%' }}
          >
            <Grid item xs={12} sm={maxWidth === 'xs' ? 8 : 10} md={maxWidth === 'xs' ? 6 : 8}>
              <StyledAuthCard
                elevation={elevation}
                role={role}
                aria-label={ariaLabel}
                tabIndex={-1}
                sx={{
                  boxShadow: theme.shadows[elevation],
                  '&:focus-within': {
                    boxShadow: theme.shadows[elevation + 1],
                  },
                }}
              >
                <Suspense fallback={<AuthLoadingFallback />}>
                  {children}
                </Suspense>
              </StyledAuthCard>
            </Grid>
          </Grid>
        </StyledAuthContainer>
      </ErrorBoundary>
    </Layout>
  );
});

// Display name for debugging
AuthLayout.displayName = 'AuthLayout';

export default AuthLayout;