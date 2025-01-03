import React from 'react'; // v18.x
import { Button, ButtonProps } from '@mui/material'; // v5.x
import { styled } from '@mui/material/styles'; // v5.x

// Extended button props interface with enhanced typing and additional features
export interface CustomButtonProps extends ButtonProps {
  children: React.ReactNode;
  variant?: 'contained' | 'outlined' | 'text';
  color?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  disabled?: boolean;
  ariaLabel?: string;
}

// Styled Material-UI button with theme integration and enhanced visual features
const StyledButton = styled(Button)(({ theme, size }) => ({
  borderRadius: '4px',
  textTransform: 'none',
  fontWeight: 'medium',
  transition: 'all 0.2s ease-in-out',
  padding: size === 'small' ? '6px 16px' : '8px 22px',
  fontSize: size === 'small' ? '0.875rem' : '1rem',
  
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  
  // Variant-specific styles
  '&.MuiButton-contained': {
    boxShadow: 'none',
    '&:hover': {
      boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
      transform: 'translateY(-1px)',
    },
  },
  
  '&.MuiButton-outlined': {
    borderWidth: '2px',
    '&:hover': {
      borderWidth: '2px',
      backgroundColor: theme.palette.action.hover,
    },
  },
  
  // Disabled state styles
  '&.Mui-disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
}));

// Theme-aware, accessible button component with standardized styling
export const CustomButton = React.memo<CustomButtonProps>(({
  children,
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  fullWidth = false,
  startIcon,
  endIcon,
  disabled = false,
  ariaLabel,
  onClick,
  ...props
}) => {
  // Handle keyboard navigation
  const handleKeyPress = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as any);
    }
  }, [onClick]);

  return (
    <StyledButton
      variant={variant}
      color={color}
      size={size}
      fullWidth={fullWidth}
      startIcon={startIcon}
      endIcon={endIcon}
      disabled={disabled}
      onClick={onClick}
      onKeyPress={handleKeyPress}
      aria-label={ariaLabel || typeof children === 'string' ? children as string : undefined}
      role="button"
      tabIndex={disabled ? -1 : 0}
      {...props}
    >
      {children}
    </StyledButton>
  );
});

// Display name for debugging
CustomButton.displayName = 'CustomButton';

export default CustomButton;