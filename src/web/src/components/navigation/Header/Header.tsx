import React, { useCallback, useState } from 'react';
import { styled } from '@mui/material/styles';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Tooltip,
  CircularProgress,
  Fade
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4,
  Brightness7,
  AccountCircle,
  ExitToApp
} from '@mui/icons-material';

import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

// Styled components with responsive design and theme support
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  transition: 'width 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms',
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[2],
  '@media (max-width: 768px)': {
    width: '100%'
  }
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  minHeight: {
    xs: '56px',
    sm: '64px'
  },
  gap: theme.spacing(1)
}));

// Props interface with required callbacks
interface HeaderProps {
  onMenuClick: () => void;
  className?: string;
  ariaLabel?: string;
}

// User menu state interface
interface UserMenuState {
  anchorEl: HTMLElement | null;
  open: boolean;
}

// Header component with accessibility support
const Header: React.FC<HeaderProps> = React.memo(({ 
  onMenuClick, 
  className,
  ariaLabel = 'Application header'
}) => {
  // Authentication state
  const { isAuthenticated, user, logout, isLoading: authLoading } = useAuth();
  
  // Theme management
  const { theme, toggleTheme, isThemeLoading } = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  // User menu state management
  const [menuState, setMenuState] = useState<UserMenuState>({
    anchorEl: null,
    open: false
  });

  // Menu handlers
  const handleMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuState({
      anchorEl: event.currentTarget,
      open: true
    });
  }, []);

  const handleMenuClose = useCallback(() => {
    setMenuState({
      anchorEl: null,
      open: false
    });
  }, []);

  // Logout handler with loading state
  const handleLogout = useCallback(async () => {
    handleMenuClose();
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout, handleMenuClose]);

  // Theme toggle with loading state
  const handleThemeToggle = useCallback(() => {
    if (!isThemeLoading) {
      toggleTheme();
    }
  }, [toggleTheme, isThemeLoading]);

  // Keyboard navigation handlers
  const handleMenuKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleMenuOpen(event as unknown as React.MouseEvent<HTMLElement>);
    }
  }, [handleMenuOpen]);

  return (
    <StyledAppBar 
      position="fixed" 
      className={className}
      aria-label={ariaLabel}
    >
      <StyledToolbar>
        {/* Navigation menu button */}
        <IconButton
          color="inherit"
          aria-label="Open navigation menu"
          edge="start"
          onClick={onMenuClick}
          size="large"
        >
          <MenuIcon />
        </IconButton>

        {/* Application title */}
        <Typography
          variant="h6"
          component="h1"
          sx={{ flexGrow: 1, ml: 2 }}
          noWrap
        >
          AI Application Intake
        </Typography>

        {/* Theme toggle with loading state */}
        <Tooltip title={`Switch to ${isDarkMode ? 'light' : 'dark'} theme`}>
          <IconButton
            color="inherit"
            onClick={handleThemeToggle}
            disabled={isThemeLoading}
            aria-label={`Switch to ${isDarkMode ? 'light' : 'dark'} theme`}
            size="large"
          >
            <Fade in={!isThemeLoading}>
              {isDarkMode ? <Brightness7 /> : <Brightness4 />}
            </Fade>
            {isThemeLoading && (
              <CircularProgress
                size={24}
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  marginTop: '-12px',
                  marginLeft: '-12px'
                }}
              />
            )}
          </IconButton>
        </Tooltip>

        {/* User profile section */}
        {isAuthenticated && !authLoading && (
          <>
            <Tooltip title="Account settings">
              <IconButton
                onClick={handleMenuOpen}
                onKeyPress={handleMenuKeyPress}
                aria-controls={menuState.open ? 'user-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={menuState.open ? 'true' : 'false'}
                aria-label="User account settings"
                size="large"
              >
                {user?.email ? (
                  <Avatar
                    alt={user.email}
                    src={`https://secure.gravatar.com/avatar/${btoa(user.email)}?s=40&d=identicon`}
                  />
                ) : (
                  <AccountCircle />
                )}
              </IconButton>
            </Tooltip>

            {/* User menu */}
            <Menu
              id="user-menu"
              anchorEl={menuState.anchorEl}
              open={menuState.open}
              onClose={handleMenuClose}
              onClick={handleMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                elevation: 0,
                sx: {
                  overflow: 'visible',
                  filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                  mt: 1.5,
                  '& .MuiAvatar-root': {
                    width: 32,
                    height: 32,
                    ml: -0.5,
                    mr: 1,
                  }
                },
              }}
            >
              <MenuItem
                onClick={handleLogout}
                aria-label="Logout"
              >
                <ExitToApp sx={{ mr: 2 }} />
                Logout
              </MenuItem>
            </Menu>
          </>
        )}
      </StyledToolbar>
    </StyledAppBar>
  );
});

Header.displayName = 'Header';

export default Header;