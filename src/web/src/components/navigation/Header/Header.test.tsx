import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe, toHaveNoViolations } from 'jest-axe';

import Header from './Header';
import { AuthProvider } from '../../../contexts/AuthContext';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { AuthState } from '../../../interfaces/auth.interface';

expect.extend(toHaveNoViolations);

// Mock hooks and providers
vi.mock('../../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useAuth: () => ({
    isAuthenticated: false,
    user: null,
    logout: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock('../../../contexts/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useTheme: () => ({
    theme: { palette: { mode: 'light' } },
    toggleTheme: vi.fn(),
    isThemeLoading: false,
  }),
}));

// Mock system color scheme preference
const mockMatchMedia = vi.fn();
window.matchMedia = mockMatchMedia;

// Enhanced render helper with providers
const renderWithProviders = (
  ui: React.ReactElement,
  {
    authState = {
      isAuthenticated: false,
      user: null,
      loading: false,
      error: null,
    },
    themeState = {
      mode: 'light',
      isLoading: false,
    },
    ...renderOptions
  } = {}
) => {
  return render(
    <AuthProvider>
      <ThemeProvider>
        {ui}
      </ThemeProvider>
    </AuthProvider>,
    renderOptions
  );
};

describe('Header Component', () => {
  const mockOnMenuClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockMatchMedia.mockImplementation(() => ({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }));
  });

  describe('Basic Rendering', () => {
    test('renders without crashing', () => {
      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />
      );
      expect(screen.getByRole('banner')).toBeInTheDocument();
    });

    test('displays application title correctly', () => {
      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />
      );
      expect(screen.getByRole('heading', { name: /AI Application Intake/i })).toBeInTheDocument();
    });

    test('renders menu button with correct accessibility attributes', () => {
      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />
      );
      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      expect(menuButton).toHaveAttribute('aria-label', 'Open navigation menu');
    });
  });

  describe('Authentication States', () => {
    test('shows user menu when authenticated', async () => {
      const mockAuthState: AuthState = {
        isAuthenticated: true,
        user: { email: 'test@example.com', id: '1', role: 'OPERATOR', permissions: [] },
        loading: false,
        error: null,
      };

      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />,
        { authState: mockAuthState }
      );

      const userButton = screen.getByRole('button', { name: /user account settings/i });
      expect(userButton).toBeInTheDocument();

      await userEvent.click(userButton);
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /logout/i })).toBeInTheDocument();
    });

    test('handles loading state correctly', () => {
      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />,
        { authState: { ...AuthState, loading: true } }
      );

      expect(screen.queryByRole('button', { name: /user account settings/i })).not.toBeInTheDocument();
    });

    test('handles logout action', async () => {
      const mockLogout = vi.fn();
      vi.mocked(useAuth).mockImplementation(() => ({
        isAuthenticated: true,
        user: { email: 'test@example.com' },
        logout: mockLogout,
        isLoading: false,
      }));

      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />
      );

      const userButton = screen.getByRole('button', { name: /user account settings/i });
      await userEvent.click(userButton);
      
      const logoutButton = screen.getByRole('menuitem', { name: /logout/i });
      await userEvent.click(logoutButton);

      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('Theme Toggle', () => {
    test('toggles theme correctly', async () => {
      const mockToggleTheme = vi.fn();
      vi.mocked(useTheme).mockImplementation(() => ({
        theme: { palette: { mode: 'light' } },
        toggleTheme: mockToggleTheme,
        isThemeLoading: false,
      }));

      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />
      );

      const themeButton = screen.getByRole('button', { name: /switch to dark theme/i });
      await userEvent.click(themeButton);

      expect(mockToggleTheme).toHaveBeenCalled();
    });

    test('shows loading state during theme transition', () => {
      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />,
        { themeState: { mode: 'light', isLoading: true } }
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('meets WCAG 2.1 Level AA standards', async () => {
      const { container } = renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test('supports keyboard navigation', async () => {
      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />
      );

      const menuButton = screen.getByRole('button', { name: /open navigation menu/i });
      await userEvent.tab();
      expect(menuButton).toHaveFocus();

      await userEvent.tab();
      const themeButton = screen.getByRole('button', { name: /switch to dark theme/i });
      expect(themeButton).toHaveFocus();
    });

    test('announces theme changes to screen readers', async () => {
      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />
      );

      const themeButton = screen.getByRole('button', { name: /switch to dark theme/i });
      await userEvent.click(themeButton);

      const announcement = screen.getByRole('status');
      expect(announcement).toHaveTextContent(/switched to dark theme/i);
    });
  });

  describe('Error Handling', () => {
    test('handles theme toggle errors gracefully', async () => {
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockToggleTheme = vi.fn().mockRejectedValue(new Error('Theme toggle failed'));

      vi.mocked(useTheme).mockImplementation(() => ({
        theme: { palette: { mode: 'light' } },
        toggleTheme: mockToggleTheme,
        isThemeLoading: false,
      }));

      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />
      );

      const themeButton = screen.getByRole('button', { name: /switch to dark theme/i });
      await userEvent.click(themeButton);

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Theme toggle failed')
      );

      mockConsoleError.mockRestore();
    });

    test('handles logout errors appropriately', async () => {
      const mockLogout = vi.fn().mockRejectedValue(new Error('Logout failed'));
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      vi.mocked(useAuth).mockImplementation(() => ({
        isAuthenticated: true,
        user: { email: 'test@example.com' },
        logout: mockLogout,
        isLoading: false,
      }));

      renderWithProviders(
        <Header onMenuClick={mockOnMenuClick} />
      );

      const userButton = screen.getByRole('button', { name: /user account settings/i });
      await userEvent.click(userButton);
      
      const logoutButton = screen.getByRole('menuitem', { name: /logout/i });
      await userEvent.click(logoutButton);

      expect(mockConsoleError).toHaveBeenCalledWith(
        'Logout failed:',
        expect.any(Error)
      );

      mockConsoleError.mockRestore();
    });
  });
});