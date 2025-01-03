import { useContext } from 'react'; // @version 18.x
import { Theme } from '@mui/material/styles'; // @version 5.x
import ThemeContext from '../contexts/ThemeContext';

/**
 * Interface defining the return type of the useTheme hook
 * with WCAG 2.1 Level AA compliant theme object
 */
interface UseThemeReturn {
  /**
   * Current Material-UI theme object with WCAG 2.1 Level AA compliant color schemes
   * Includes both light and dark mode palettes with proper contrast ratios
   */
  theme: Theme;

  /**
   * Function to toggle between light and dark themes
   * Handles persistence, system preferences, and accessibility announcements
   */
  toggleTheme: () => void;
}

/**
 * Custom hook for managing theme state and preferences
 * Provides access to WCAG compliant Material-UI theme and theme toggling functionality
 * 
 * @returns {UseThemeReturn} Object containing theme and toggleTheme function
 * @throws {Error} If used outside of ThemeProvider context
 * 
 * @example
 * const { theme, toggleTheme } = useTheme();
 */
export const useTheme = (): UseThemeReturn => {
  // Access theme context with strict null checks
  const context = useContext(ThemeContext);

  // Verify context is available
  if (context === undefined) {
    throw new Error(
      'useTheme must be used within a ThemeProvider (src/web/src/hooks/useTheme.ts)'
    );
  }

  // Return strongly-typed theme object and toggleTheme function
  return {
    theme: context.theme,
    toggleTheme: context.toggleTheme,
  };
};

export type { UseThemeReturn };