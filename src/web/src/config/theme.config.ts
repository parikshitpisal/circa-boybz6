import { createTheme, Theme, ThemeOptions } from '@mui/material/styles'; // @mui/material v5.x
import lightTheme from '../assets/themes/light';
import darkTheme from '../assets/themes/dark';

// Theme mode type definition
export type ThemeMode = 'light' | 'dark';

// Storage key for theme preference
const STORAGE_KEY = 'theme-preference';

/**
 * Retrieves the initial theme preference from localStorage or system preference
 * @returns {ThemeMode} The initial theme mode ('light' or 'dark')
 */
export const getInitialTheme = (): ThemeMode => {
  try {
    // Check localStorage first
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      return savedTheme;
    }

    // Check system preference if no saved theme
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    // Default to light theme
    return 'light';
  } catch (error) {
    console.warn('Error accessing localStorage for theme preference:', error);
    return 'light';
  }
};

/**
 * Creates a customized Material-UI theme with the specified mode
 * @param {ThemeMode} mode - The theme mode ('light' or 'dark')
 * @returns {Theme} The customized Material-UI theme
 */
export const createCustomTheme = (mode: ThemeMode): Theme => {
  // Select base theme configuration
  const baseTheme = mode === 'light' ? lightTheme : darkTheme;

  // Create custom theme with specified configurations
  return createTheme({
    ...baseTheme,
    // Custom breakpoints as per specification
    breakpoints: {
      values: {
        xs: 320,
        sm: 768,
        md: 1024,
        lg: 1440,
        xl: 1920,
      },
    },
    // Typography configuration with base font size 16px
    typography: {
      fontFamily: 'Roboto, Arial, sans-serif',
      fontSize: 16,
      htmlFontSize: 16,
      fontWeightLight: 300,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
    },
    // Shape configuration
    shape: {
      borderRadius: 4,
    },
    // Base spacing unit of 8px
    spacing: 8,
    // Component customizations
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            textTransform: 'none',
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            borderRadius: 4,
          },
        },
      },
    },
  });
};

// Create default theme
export const defaultTheme = createCustomTheme(getInitialTheme());

// Export theme configuration utilities
export const themeConfig = {
  createCustomTheme,
  getInitialTheme,
};

export default defaultTheme;