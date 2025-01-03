import React, { useCallback, useState, useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { Box, Container, useMediaQuery } from '@mui/material';

import Header from '../components/navigation/Header/Header';
import Sidebar from '../components/navigation/Sidebar/Sidebar';

// Styled components with theme-aware styles and accessibility support
const StyledBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  position: 'relative',
  overflow: 'hidden',
  transition: theme.transitions.create('background-color', {
    duration: theme.transitions.duration.standard,
  }),
}));

const StyledContainer = styled(Container, {
  shouldForwardProp: (prop) => prop !== 'isSidebarOpen',
})<{ isSidebarOpen: boolean }>(({ theme, isSidebarOpen }) => ({
  marginTop: theme.spacing(8), // Height of header
  padding: theme.spacing(3),
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  [theme.breakpoints.up('md')]: {
    marginLeft: isSidebarOpen ? 240 : 0, // Sidebar width
    width: `calc(100% - ${isSidebarOpen ? 240 : 0}px)`,
  },
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  zIndex: 1,
}));

// Props interface with accessibility support
interface MainLayoutProps {
  children: React.ReactNode;
  className?: string;
  role?: string;
}

/**
 * Main layout component that provides the core application structure
 * Implements responsive design and accessibility requirements
 */
const MainLayout: React.FC<MainLayoutProps> = React.memo(({
  children,
  className,
  role = 'main'
}) => {
  // Responsive breakpoint detection
  const isMobile = useMediaQuery((theme: any) => theme.breakpoints.down('md'));
  
  // Sidebar state management
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobile);

  // Update sidebar state on breakpoint changes
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  // Sidebar toggle handler with accessibility support
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
    
    // Announce state change to screen readers
    const message = `Navigation menu ${!isSidebarOpen ? 'opened' : 'closed'}`;
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, [isSidebarOpen]);

  // Handle keyboard navigation
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && isSidebarOpen && isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isSidebarOpen, isMobile]);

  return (
    <StyledBox 
      className={className}
      onKeyDown={handleKeyPress}
      role={role}
      aria-label="Application layout"
    >
      {/* Header with accessibility support */}
      <Header
        onMenuClick={handleSidebarToggle}
        aria-label="Main header"
        role="banner"
      />

      {/* Navigation sidebar with accessibility support */}
      <Sidebar
        open={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        aria-expanded={isSidebarOpen}
        role="navigation"
      />

      {/* Main content area with proper spacing and ARIA attributes */}
      <StyledContainer
        maxWidth={false}
        isSidebarOpen={isSidebarOpen}
        component="main"
        aria-label="Main content"
        role="region"
      >
        {children}
      </StyledContainer>
    </StyledBox>
  );
});

// Display name for debugging
MainLayout.displayName = 'MainLayout';

export default MainLayout;