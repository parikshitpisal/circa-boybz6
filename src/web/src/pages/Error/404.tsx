import React from 'react'; // ^18.0.0
import { Box, Typography, Container, useTheme } from '@mui/material'; // ^5.0.0
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0
import Layout from '../../components/common/Layout/Layout';
import CustomButton from '../../components/common/Button/Button';

// Styled container for centered content with responsive layout
const StyledContainer = styled(Container)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60vh',
  textAlign: 'center',
  padding: theme.spacing(3),
  gap: theme.spacing(2),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    minHeight: '50vh',
  },
}));

/**
 * NotFoundPage component displays a user-friendly 404 error message with navigation
 * options while maintaining WCAG 2.1 Level AA compliance.
 */
const NotFoundPage = React.memo(() => {
  const navigate = useNavigate();
  const theme = useTheme();

  /**
   * Handles navigation back to dashboard with keyboard support
   * @param event - Mouse or keyboard event
   */
  const handleBackToDashboard = React.useCallback(
    (event: React.KeyboardEvent | React.MouseEvent) => {
      // Only proceed if it's not a keyboard event or if it's an Enter key press
      if (!('key' in event) || event.key === 'Enter') {
        navigate('/dashboard');
      }
    },
    [navigate]
  );

  return (
    <Layout
      maxWidth="lg"
      role="main"
      aria-label="404 Error Page"
    >
      <StyledContainer>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: theme.spacing(3),
          }}
        >
          <Typography
            variant="h1"
            component="h1"
            sx={{
              fontSize: {
                xs: '2.5rem',
                sm: '3rem',
                md: '3.5rem',
              },
              fontWeight: 600,
              color: theme.palette.text.primary,
              marginBottom: theme.spacing(2),
            }}
            aria-label="404 - Page Not Found"
          >
            404
          </Typography>

          <Typography
            variant="h2"
            component="h2"
            sx={{
              fontSize: {
                xs: '1.5rem',
                sm: '1.75rem',
                md: '2rem',
              },
              fontWeight: 500,
              color: theme.palette.text.secondary,
              marginBottom: theme.spacing(3),
            }}
          >
            Page Not Found
          </Typography>

          <Typography
            variant="body1"
            sx={{
              maxWidth: '600px',
              marginBottom: theme.spacing(4),
              color: theme.palette.text.secondary,
            }}
            aria-label="The page you are looking for might have been removed, had its name changed, or is temporarily unavailable."
          >
            The page you are looking for might have been removed, had its name
            changed, or is temporarily unavailable.
          </Typography>

          <CustomButton
            variant="contained"
            color="primary"
            onClick={handleBackToDashboard}
            onKeyPress={handleBackToDashboard}
            aria-label="Return to Dashboard"
            sx={{
              minWidth: '200px',
              [theme.breakpoints.down('sm')]: {
                width: '100%',
              },
            }}
          >
            Return to Dashboard
          </CustomButton>
        </Box>
      </StyledContainer>
    </Layout>
  );
});

// Display name for debugging
NotFoundPage.displayName = 'NotFoundPage';

export default NotFoundPage;