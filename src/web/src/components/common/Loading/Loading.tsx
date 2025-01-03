import React, { useEffect, useCallback } from 'react';
import { CircularProgress, Box, Typography, useTheme } from '@mui/material';
import { lightTheme } from '../../../assets/themes/light';

// Size mapping for the loading spinner
const SPINNER_SIZES = {
  small: 24,
  medium: 40,
  large: 56,
} as const;

// Test ID for component testing
const TEST_ID = 'loading-component';

// ARIA labels for accessibility
const ARIA_LABELS = {
  loading: 'Content is loading',
  loadingWithText: (text: string) => `Loading: ${text}`,
};

interface LoadingProps {
  /**
   * Size of the loading spinner
   * @default 'medium'
   */
  size?: keyof typeof SPINNER_SIZES;
  /**
   * Optional text to display below the spinner
   */
  text?: string;
  /**
   * Whether to show the loading in a modal overlay
   * @default false
   */
  overlay?: boolean;
  /**
   * Optional timeout in milliseconds
   */
  timeout?: number;
}

/**
 * A reusable loading component that provides visual feedback during asynchronous operations
 * with WCAG 2.1 Level AA compliance.
 */
export const Loading: React.FC<LoadingProps> = ({
  size = 'medium',
  text,
  overlay = false,
  timeout,
}) => {
  const theme = useTheme();

  // Handle ESC key press for overlay mode
  const handleEscapeKey = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && overlay) {
      // Prevent default behavior
      event.preventDefault();
    }
  }, [overlay]);

  // Set up event listeners and cleanup
  useEffect(() => {
    if (overlay) {
      document.addEventListener('keydown', handleEscapeKey);
      // Lock body scroll when overlay is active
      document.body.style.overflow = 'hidden';
      
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
        document.body.style.overflow = 'unset';
      };
    }
  }, [overlay, handleEscapeKey]);

  // Handle timeout if specified
  useEffect(() => {
    if (timeout) {
      const timer = setTimeout(() => {
        // Timeout handling can be implemented by parent component
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [timeout]);

  // Base container styles
  const containerStyles = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    minHeight: '100px',
  } as const;

  // Overlay styles
  const overlayStyles = overlay ? {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: theme.zIndex.modal,
    backdropFilter: 'blur(4px)',
  } as const : {};

  // Text styles with WCAG compliant colors
  const textStyles = {
    color: lightTheme.palette.text.secondary,
    marginTop: 1,
    textAlign: 'center',
    maxWidth: '80%',
    wordBreak: 'break-word',
  } as const;

  return (
    <Box
      sx={{ ...containerStyles, ...overlayStyles }}
      role="alert"
      aria-busy="true"
      aria-live="polite"
      data-testid={TEST_ID}
    >
      <CircularProgress
        size={SPINNER_SIZES[size]}
        aria-label={text ? ARIA_LABELS.loadingWithText(text) : ARIA_LABELS.loading}
        sx={{
          color: lightTheme.palette.primary.main,
        }}
      />
      {text && (
        <Typography
          variant="body2"
          component="div"
          sx={textStyles}
          aria-hidden="false"
        >
          {text}
        </Typography>
      )}
    </Box>
  );
};

export default Loading;