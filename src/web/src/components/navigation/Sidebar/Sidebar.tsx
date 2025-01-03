import React, { useCallback, useMemo } from 'react';
import { styled } from '@mui/material/styles';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { PRIVATE_ROUTES } from '../../constants/routes.constants';
import { useAuth } from '../../hooks/useAuth';

// Version comments for external dependencies
// @mui/material v5.x
// react-router-dom v6.x

/**
 * Interface for navigation menu items with security and accessibility features
 */
interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: string[];
  ariaLabel: string;
  accessKey?: string;
}

/**
 * Props interface for Sidebar component with enhanced accessibility
 */
interface SidebarProps {
  open: boolean;
  onClose: () => void;
  ariaLabel?: string;
  role?: string;
}

// Styled components with accessibility and responsive design
const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: 240,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  '& .MuiDrawer-paper': {
    width: 240,
    transition: theme.transitions.create('width', {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: 'hidden',
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
  },
  '& .MuiListItem-root': {
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  },
}));

const StyledList = styled(List)(({ theme }) => ({
  padding: theme.spacing(2, 0),
  width: '100%',
  '& .MuiListItem-root': {
    marginBottom: theme.spacing(0.5),
    borderRadius: theme.shape.borderRadius,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
    },
  },
}));

/**
 * Enhanced Sidebar component with security monitoring and accessibility features
 */
const Sidebar: React.FC<SidebarProps> = React.memo(({
  open,
  onClose,
  ariaLabel = 'Main navigation',
  role = 'navigation'
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logNavigationEvent } = useAuth();

  // Navigation items with role-based access control
  const navigationItems = useMemo((): NavigationItem[] => [
    {
      id: 'dashboard',
      label: 'Dashboard',
      path: PRIVATE_ROUTES.DASHBOARD,
      icon: <span role="img" aria-label="Dashboard icon">📊</span>,
      roles: ['ADMIN', 'OPERATOR', 'AUDITOR'],
      ariaLabel: 'Navigate to dashboard',
      accessKey: 'd'
    },
    {
      id: 'applications',
      label: 'Applications',
      path: PRIVATE_ROUTES.APPLICATIONS.LIST,
      icon: <span role="img" aria-label="Applications icon">📝</span>,
      roles: ['ADMIN', 'OPERATOR'],
      ariaLabel: 'Navigate to applications list',
      accessKey: 'a'
    },
    {
      id: 'documents',
      label: 'Documents',
      path: PRIVATE_ROUTES.DOCUMENTS.LIST,
      icon: <span role="img" aria-label="Documents icon">📄</span>,
      roles: ['ADMIN', 'OPERATOR'],
      ariaLabel: 'Navigate to documents list',
      accessKey: 'f'
    },
    {
      id: 'settings',
      label: 'Settings',
      path: PRIVATE_ROUTES.SETTINGS.PROFILE,
      icon: <span role="img" aria-label="Settings icon">⚙️</span>,
      roles: ['ADMIN'],
      ariaLabel: 'Navigate to settings',
      accessKey: 's'
    }
  ], []);

  // Enhanced navigation handler with security logging
  const handleNavigate = useCallback((path: string, itemId: string) => {
    logNavigationEvent({
      destination: path,
      itemId,
      timestamp: new Date(),
      userId: user?.id
    });

    if (isMobile) {
      onClose();
    }

    // Announce navigation to screen readers
    const announcement = `Navigating to ${path}`;
    const announcer = document.createElement('div');
    announcer.setAttribute('role', 'alert');
    announcer.setAttribute('aria-live', 'polite');
    announcer.textContent = announcement;
    document.body.appendChild(announcer);
    setTimeout(() => document.body.removeChild(announcer), 1000);

    navigate(path);
  }, [navigate, onClose, isMobile, user, logNavigationEvent]);

  // Filter navigation items based on user role
  const authorizedItems = useMemo(() => 
    navigationItems.filter(item => 
      user?.role && item.roles.includes(user.role)
    ),
    [navigationItems, user?.role]
  );

  return (
    <StyledDrawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={open}
      onClose={onClose}
      ModalProps={{
        keepMounted: true, // Better mobile performance
      }}
      aria-label={ariaLabel}
      role={role}
    >
      <StyledList
        role="menu"
        aria-label="Navigation menu"
      >
        {authorizedItems.map((item) => (
          <ListItem
            key={item.id}
            onClick={() => handleNavigate(item.path, item.id)}
            button
            role="menuitem"
            aria-label={item.ariaLabel}
            accessKey={item.accessKey}
            tabIndex={0}
          >
            <ListItemIcon aria-hidden="true">
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                variant: 'body2',
                color: 'textPrimary'
              }}
            />
          </ListItem>
        ))}
      </StyledList>
    </StyledDrawer>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;