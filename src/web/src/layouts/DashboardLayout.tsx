import React, { useCallback, useEffect, useState } from 'react';
import { Box, useMediaQuery, Fade } from '@mui/material';
import { useTheme, styled } from '@mui/material/styles';
import { ErrorBoundary } from 'react-error-boundary';

import Header from '../components/navigation/Header/Header';
import Sidebar from '../components/navigation/Sidebar/Sidebar';

// Styled components with theme-aware styling
const StyledBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  transition: 'background-color 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms',
}));

const MainContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'sidebarOpen',
})<{ sidebarOpen: boolean }>(({ theme, sidebarOpen }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: 'margin 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms',
  marginLeft: {
    xs: 0,
    md: sidebarOpen ? 240 : 0,
  },
  minHeight: '100vh',
  position: 'relative',
  [theme.breakpoints.down('md')]: {
    padding: theme.spacing(2),
  },
}));

// Props interface
interface DashboardLayoutProps {
  children: React.ReactNode;
  className?: string;
  initialSidebarOpen?: boolean;
}

/**
 * DashboardLayout component providing the main application structure
 * Implements responsive design, accessibility, and theme support
 */
const DashboardLayout: React.FC<DashboardLayoutProps> = React.memo(({
  children,
  className,
  initialSidebarOpen = true,
}) => {
  // Theme and responsive hooks
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // Sidebar state management
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile && initialSidebarOpen);

  // Update sidebar state on screen size changes
  useEffect(() => {
    setSidebarOpen(!isMobile && initialSidebarOpen);
  }, [isMobile, initialSidebarOpen]);

  // Sidebar toggle handler with accessibility announcement
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen((prev) => {
      const newState = !prev;
      
      // Announce state change to screen readers
      const message = `Navigation menu ${newState ? 'opened' : 'closed'}`;
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = message;
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);

      return newState;
    });
  }, []);

  // Keyboard navigation handler
  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && sidebarOpen && isMobile) {
      setSidebarOpen(false);
    }
  }, [sidebarOpen, isMobile]);

  // Error fallback component
  const ErrorFallback = useCallback(({ error }: { error: Error }) => (
    <Box
      role="alert"
      aria-live="assertive"
      sx={{
        p: 3,
        color: 'error.main',
        textAlign: 'center'
      }}
    >
      <h2>Something went wrong in the dashboard layout</h2>
      <pre>{error.message}</pre>
    </Box>
  ), []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <StyledBox 
        className={className}
        onKeyDown={handleKeyboardNavigation}
        role="main"
        aria-label="Dashboard layout"
      >
        <Header
          onMenuClick={handleSidebarToggle}
          ariaLabel="Application header"
        />
        
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          role="navigation"
          ariaLabel="Main navigation"
        />

        <Fade in={true} timeout={300}>
          <MainContent
            component="main"
            sidebarOpen={sidebarOpen}
            role="region"
            aria-label="Main content"
          >
            {children}
          </MainContent>
        </Fade>
      </StyledBox>
    </ErrorBoundary>
  );
});

// Display name for debugging
DashboardLayout.displayName = 'DashboardLayout';

export default DashboardLayout;