import React from 'react'; // ^18.0.0
import { Card as MuiCard, CardProps } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0

// Default elevation level for cards
const DEFAULT_ELEVATION = 1;

/**
 * Props interface extending Material-UI CardProps with custom properties
 */
interface CustomCardProps extends CardProps {
  /**
   * Custom elevation level for card shadow (1-24)
   * @default 1
   */
  elevation?: number;
  
  /**
   * Additional CSS classes for custom styling
   */
  className?: string;
  
  /**
   * Card content elements
   */
  children: React.ReactNode;
  
  /**
   * ARIA role for accessibility
   * @default 'article'
   */
  role?: string;
  
  /**
   * Card variant style
   * @default 'elevation'
   */
  variant?: 'elevation' | 'outlined';
}

/**
 * Styled Card component with theme-aware styles and accessibility enhancements
 */
const StyledCard = styled(MuiCard, {
  shouldForwardProp: (prop) => prop !== 'elevation',
})<CustomCardProps>(({ theme, elevation = DEFAULT_ELEVATION }) => ({
  borderRadius: '8px',
  transition: 'box-shadow 0.3s ease-in-out, background-color 0.3s ease-in-out',
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  position: 'relative',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  
  // Enhanced shadow on hover for interactive feedback
  '&:hover': {
    boxShadow: theme.shadows[Math.min(elevation + 1, 24)],
  },
  
  // Focus state for keyboard navigation
  '&:focus-within': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
  
  // High contrast mode support
  '@media (forced-colors: active)': {
    borderColor: 'CanvasText',
  },
  
  // Ensure proper contrast in both light and dark modes
  ...(theme.palette.mode === 'dark' && {
    backgroundColor: theme.palette.grey[800],
    '&:hover': {
      backgroundColor: theme.palette.grey[700],
    },
  }),
}));

/**
 * A themed card component with customizable elevation, accessibility support,
 * and theme integration.
 * 
 * @component
 * @example
 * ```tsx
 * <Card elevation={2} role="region">
 *   <CardContent>Card content here</CardContent>
 * </Card>
 * ```
 */
const Card = React.memo<CustomCardProps>(({
  elevation = DEFAULT_ELEVATION,
  className,
  children,
  role = 'article',
  variant = 'elevation',
  ...props
}) => {
  // Validate elevation range
  const validElevation = Math.max(0, Math.min(elevation, 24));

  return (
    <StyledCard
      elevation={validElevation}
      className={className}
      role={role}
      variant={variant}
      tabIndex={props.tabIndex ?? 0}
      aria-label={props['aria-label']}
      {...props}
    >
      {children}
    </StyledCard>
  );
});

// Display name for debugging
Card.displayName = 'Card';

export default Card;