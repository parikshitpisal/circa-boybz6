import React, { useEffect, useCallback } from 'react';
// @mui/material v5.0.0
import { Alert as MuiAlert, AlertProps } from '@mui/material';
// @mui/material v5.0.0
import { IconButton } from '@mui/material';
// @mui/material v5.0.0
import { useTheme } from '@mui/material';
// @mui/icons-material v5.0.0
import { Close } from '@mui/icons-material';

interface CustomAlertProps extends Omit<AlertProps, 'children'> {
  /** Alert message content to display */
  message: string;
  /** Alert severity level determining color and icon */
  severity?: 'success' | 'error' | 'warning' | 'info';
  /** Callback function when alert is closed */
  onClose?: () => void;
  /** Duration in milliseconds before auto-hiding the alert */
  autoHideDuration?: number;
  /** Shadow depth for the alert component */
  elevation?: number;
  /** Visual style variant of the alert */
  variant?: 'filled' | 'outlined' | 'standard';
}

/**
 * Enhanced Material-UI Alert component with auto-hide functionality and accessibility features.
 * Implements WCAG 2.1 Level AA compliance with proper ARIA attributes and color contrast.
 * 
 * @param props - CustomAlertProps for configuring the alert
 * @returns JSX.Element - Rendered alert component
 */
const Alert = React.memo<CustomAlertProps>(({
  message,
  severity = 'info',
  onClose,
  autoHideDuration,
  elevation = 1,
  variant = 'filled',
  ...props
}) => {
  const theme = useTheme();

  // Handle auto-hide functionality
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (autoHideDuration && onClose) {
      timeoutId = setTimeout(() => {
        onClose();
      }, autoHideDuration);
    }

    // Cleanup timeout on unmount
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [autoHideDuration, onClose]);

  // Memoized close handler
  const handleClose = useCallback((event: React.SyntheticEvent) => {
    event.preventDefault();
    onClose?.();
  }, [onClose]);

  // Get theme-based styles
  const getAlertStyle = () => ({
    marginBottom: theme.spacing(2),
    boxShadow: elevation ? theme.shadows[elevation] : 'none',
    '& .MuiAlert-icon': {
      marginRight: theme.spacing(1)
    }
  });

  return (
    <MuiAlert
      severity={severity}
      variant={variant}
      sx={getAlertStyle()}
      // Accessibility attributes
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      // Additional props spread
      {...props}
      action={
        onClose ? (
          <IconButton
            aria-label="Close alert"
            color="inherit"
            size="small"
            onClick={handleClose}
          >
            <Close fontSize="small" />
          </IconButton>
        ) : null
      }
    >
      {message}
    </MuiAlert>
  );
});

// Display name for debugging
Alert.displayName = 'Alert';

export default Alert;