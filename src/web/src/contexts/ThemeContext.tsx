import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { ThemeProvider as MuiThemeProvider, Theme } from '@mui/material/styles'; // @mui/material v5.x
import lightTheme from '../assets/themes/light';
import darkTheme from '../assets/themes/dark';

// Constants
const THEME_STORAGE_KEY = 'theme_preference';
const THEME_SWITCH_DEBOUNCE_MS = 150;

// Interfaces
interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isThemeLoading: boolean;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

// Create context with type safety
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Custom hook for theme management
const useThemePreference = () => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(lightTheme);
  const [isThemeLoading, setIsThemeLoading] = useState(true);
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  // System preference media query
  const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)');

  // Get initial theme preference
  const getInitialTheme = useCallback((): Theme => {
    try {
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (storedTheme === 'dark' || storedTheme === 'light') {
        return storedTheme === 'dark' ? darkTheme : lightTheme;
      }
      return prefersDarkMode.matches ? darkTheme : lightTheme;
    } catch (error) {
      console.warn('Failed to access localStorage for theme preference:', error);
      return lightTheme;
    }
  }, [prefersDarkMode.matches]);

  // Save theme preference
  const saveThemePreference = useCallback((theme: Theme) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme === darkTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, []);

  // Handle system preference changes
  const handleSystemPreferenceChange = useCallback((e: MediaQueryListEvent) => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      setCurrentTheme(e.matches ? darkTheme : lightTheme);
    }
  }, []);

  // Initialize theme
  useEffect(() => {
    const initialTheme = getInitialTheme();
    setCurrentTheme(initialTheme);
    setIsThemeLoading(false);

    // Add system preference listener
    try {
      prefersDarkMode.addEventListener('change', handleSystemPreferenceChange);
    } catch (error) {
      console.warn('System preference detection not supported:', error);
    }

    return () => {
      try {
        prefersDarkMode.removeEventListener('change', handleSystemPreferenceChange);
      } catch (error) {
        console.warn('Failed to remove system preference listener:', error);
      }
    };
  }, [getInitialTheme, handleSystemPreferenceChange]);

  // Debounced theme toggle
  const toggleTheme = useCallback(() => {
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }

    setDebounceTimeout(
      setTimeout(() => {
        setIsThemeLoading(true);
        try {
          const newTheme = currentTheme === lightTheme ? darkTheme : lightTheme;
          setCurrentTheme(newTheme);
          saveThemePreference(newTheme);
          
          // Announce theme change to screen readers
          const message = `Switched to ${newTheme === darkTheme ? 'dark' : 'light'} theme`;
          const announcement = document.createElement('div');
          announcement.setAttribute('role', 'status');
          announcement.setAttribute('aria-live', 'polite');
          announcement.textContent = message;
          document.body.appendChild(announcement);
          setTimeout(() => document.body.removeChild(announcement), 1000);
        } catch (error) {
          console.error('Failed to toggle theme:', error);
        } finally {
          setIsThemeLoading(false);
        }
      }, THEME_SWITCH_DEBOUNCE_MS)
    );
  }, [currentTheme, debounceTimeout, saveThemePreference]);

  // Clean up debounce timeout
  useEffect(() => {
    return () => {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  }, [debounceTimeout]);

  return { currentTheme, toggleTheme, isThemeLoading };
};

// Theme Provider Component
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { currentTheme, toggleTheme, isThemeLoading } = useThemePreference();

  // Memoize context value to prevent unnecessary rerenders
  const contextValue = useMemo(
    () => ({
      theme: currentTheme,
      toggleTheme,
      isThemeLoading,
    }),
    [currentTheme, toggleTheme, isThemeLoading]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={currentTheme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// Custom hook for consuming theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;