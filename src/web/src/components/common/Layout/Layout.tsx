import React from 'react'; // ^18.0.0
import { Box, Container, Grid } from '@mui/material'; // ^5.0.0
import { styled, useTheme } from '@mui/material/styles'; // ^5.0.0
import Card from '../Card/Card'; // Internal component

/**
 * Props interface for Layout component with accessibility and responsive design support
 */
interface LayoutProps {
  /**
   * Content to be rendered within layout
   */
  children: React.ReactNode;
  
  /**
   * Maximum width constraint for content
   * @default 'lg'
   */
  maxWidth?: false | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  
  /**
   * Grid spacing between content elements
   * @default 3
   */
  spacing?: number;
  
  /**
   * ARIA role for semantic structure
   * @default 'main'
   */
  role?: string;
  
  /**
   * Accessibility label for layout region
   */
  'aria-label'?: string;
}

/**
 * Styled Container component with responsive padding and transitions
 */
const StyledContainer = styled(Container)(({ theme }) => ({
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3),
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  paddingLeft: {
    xs: theme.spacing(2),
    sm: theme.spacing(3),
    md: theme.spacing(4),
  },
  paddingRight: {
    xs: theme.spacing(2),
    sm: theme.spacing(3),
    md: theme.spacing(4),
  },
  transition: 'padding 0.3s ease',
  
  // Ensure proper spacing in both light and dark modes
  ...(theme.palette.mode === 'dark' && {
    backgroundColor: theme.palette.background.default,
  }),
}));

/**
 * Styled Grid component with flexible layout support
 */
const StyledGrid = styled(Grid)({
  width: '100%',
  margin: 0,
  flex: 1,
  container: true,
  alignItems: 'stretch',
  justifyContent: 'flex-start',
});

/**
 * A reusable layout component that provides consistent structure and spacing
 * with Material-UI v5 integration, responsive design, and accessibility compliance.
 * 
 * @component
 */
const Layout = React.memo<LayoutProps>(({
  children,
  maxWidth = 'lg',
  spacing = 3,
  role = 'main',
  'aria-label': ariaLabel,
}) => {
  const theme = useTheme();

  return (
    <StyledContainer
      maxWidth={maxWidth}
      component="main"
      role={role}
      aria-label={ariaLabel}
    >
      <StyledGrid
        container
        spacing={spacing}
        sx={{
          [theme.breakpoints.down('sm')]: {
            spacing: Math.max(spacing - 1, 1),
          },
        }}
      >
        <Grid item xs={12}>
          <Card elevation={0}>
            <Box
              sx={{
                width: '100%',
                height: '100%',
                position: 'relative',
                // Ensure proper focus indication for accessibility
                '&:focus-within': {
                  outline: `2px solid ${theme.palette.primary.main}`,
                  outlineOffset: '2px',
                },
              }}
            >
              {children}
            </Box>
          </Card>
        </Grid>
      </StyledGrid>
    </StyledContainer>
  );
});

// Display name for debugging
Layout.displayName = 'Layout';

export default Layout;