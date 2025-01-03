import React from 'react'; // ^18.0.0
import { Box, Typography, Stack } from '@mui/material'; // ^5.0.0
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import Layout from '../../components/common/Layout/Layout';
import CustomButton from '../../components/common/Button/Button';

/**
 * Enhanced 500 Internal Server Error page component with accessibility features
 * and responsive design following WCAG 2.1 Level AA guidelines.
 */
const InternalServerError = React.memo(() => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);

  /**
   * Handles navigation back to dashboard with loading state and error handling
   */
  const handleBackToDashboard = React.useCallback(async () => {
    try {
      setIsLoading(true);
      await navigate('/dashboard');
    } catch (error) {
      console.error('Navigation error:', error);
      // Reset loading state if navigation fails
      setIsLoading(false);
    }
  }, [navigate]);

  return (
    <Layout maxWidth="lg">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: {
            xs: 2,
            sm: 3,
            md: 4
          }
        }}
      >
        <Stack
          spacing={{ xs: 3, sm: 4, md: 5 }}
          alignItems="center"
          sx={{
            textAlign: 'center',
            maxWidth: {
              xs: '100%',
              sm: '500px',
              md: '600px'
            }
          }}
        >
          {/* Error illustration - Using Typography for better accessibility */}
          <Typography
            variant="h1"
            sx={{
              fontSize: {
                xs: '4rem',
                sm: '5rem',
                md: '6rem'
              },
              color: 'error.main',
              userSelect: 'none'
            }}
            aria-hidden="true"
          >
            500
          </Typography>

          {/* Main error heading */}
          <Typography
            variant="h2"
            sx={{
              fontSize: {
                xs: '1.5rem',
                sm: '1.75rem',
                md: '2rem'
              },
              fontWeight: 'bold',
              color: 'text.primary'
            }}
            role="heading"
            aria-level={1}
          >
            Internal Server Error
          </Typography>

          {/* Error description */}
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              fontSize: {
                xs: '1rem',
                sm: '1.125rem'
              },
              maxWidth: '90%'
            }}
          >
            We apologize for the inconvenience. Our team has been notified and is working to resolve the issue. Please try again later.
          </Typography>

          {/* Navigation button */}
          <CustomButton
            variant="contained"
            color="primary"
            onClick={handleBackToDashboard}
            disabled={isLoading}
            aria-label="Return to dashboard"
            sx={{
              mt: { xs: 2, sm: 3 }
            }}
          >
            Back to Dashboard
          </CustomButton>
        </Stack>
      </Box>
    </Layout>
  );
});

// Display name for debugging
InternalServerError.displayName = 'InternalServerError';

export default InternalServerError;