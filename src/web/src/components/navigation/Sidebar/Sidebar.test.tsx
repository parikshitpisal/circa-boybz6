import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { useMediaQuery } from '@mui/material';
import { customRender } from '../../../tests/utils/test-utils';
import { Sidebar } from './Sidebar';
import { PRIVATE_ROUTES } from '../../../constants/routes.constants';
import { UserRole } from '../../../interfaces/auth.interface';

// Mock Material-UI useMediaQuery hook
jest.mock('@mui/material', () => ({
  ...jest.requireActual('@mui/material'),
  useMediaQuery: jest.fn()
}));

// Mock useAuth hook
jest.mock('../../../hooks/useAuth', () => ({
  useAuth: jest.fn()
}));

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

describe('Sidebar Component', () => {
  // Setup test props
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    ariaLabel: 'Main navigation',
    role: 'navigation'
  };

  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Role-Based Access Control', () => {
    it('should render correct menu items for Admin role', () => {
      // Mock admin user
      (useAuth as jest.Mock).mockReturnValue({
        user: { role: UserRole.ADMIN },
        logNavigationEvent: jest.fn()
      });

      customRender(<Sidebar {...defaultProps} />);

      // Verify all menu items are visible for admin
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Applications')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });

    it('should render limited menu items for Operator role', () => {
      // Mock operator user
      (useAuth as jest.Mock).mockReturnValue({
        user: { role: UserRole.OPERATOR },
        logNavigationEvent: jest.fn()
      });

      customRender(<Sidebar {...defaultProps} />);

      // Verify operator-specific menu items
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Applications')).toBeInTheDocument();
      expect(screen.getByText('Documents')).toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('should render read-only menu items for Auditor role', () => {
      // Mock auditor user
      (useAuth as jest.Mock).mockReturnValue({
        user: { role: UserRole.AUDITOR },
        logNavigationEvent: jest.fn()
      });

      customRender(<Sidebar {...defaultProps} />);

      // Verify auditor-specific menu items
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.queryByText('Applications')).not.toBeInTheDocument();
      expect(screen.queryByText('Documents')).not.toBeInTheDocument();
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should render as temporary drawer on mobile', () => {
      // Mock mobile viewport
      (useMediaQuery as jest.Mock).mockReturnValue(true);

      const { container } = customRender(<Sidebar {...defaultProps} />);

      expect(container.querySelector('.MuiDrawer-temporary')).toBeInTheDocument();
    });

    it('should render as permanent drawer on desktop', () => {
      // Mock desktop viewport
      (useMediaQuery as jest.Mock).mockReturnValue(false);

      const { container } = customRender(<Sidebar {...defaultProps} />);

      expect(container.querySelector('.MuiDrawer-permanent')).toBeInTheDocument();
    });

    it('should close drawer on mobile after navigation', () => {
      // Mock mobile viewport
      (useMediaQuery as jest.Mock).mockReturnValue(true);
      (useAuth as jest.Mock).mockReturnValue({
        user: { role: UserRole.ADMIN },
        logNavigationEvent: jest.fn()
      });

      customRender(<Sidebar {...defaultProps} />);

      // Click navigation item
      fireEvent.click(screen.getByText('Dashboard'));

      expect(defaultProps.onClose).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith(PRIVATE_ROUTES.DASHBOARD);
    });
  });

  describe('Accessibility', () => {
    it('should meet WCAG 2.1 Level AA requirements', async () => {
      const { container } = customRender(<Sidebar {...defaultProps} />);
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { role: UserRole.ADMIN },
        logNavigationEvent: jest.fn()
      });

      customRender(<Sidebar {...defaultProps} />);

      const menuItems = screen.getAllByRole('menuitem');

      // Test keyboard focus
      menuItems.forEach(item => {
        item.focus();
        expect(document.activeElement).toBe(item);
      });

      // Test keyboard activation
      fireEvent.keyDown(menuItems[0], { key: 'Enter' });
      expect(mockNavigate).toHaveBeenCalled();
    });

    it('should have proper ARIA attributes', () => {
      customRender(<Sidebar {...defaultProps} />);

      const navigation = screen.getByRole('navigation');
      expect(navigation).toHaveAttribute('aria-label', 'Main navigation');

      const menu = screen.getByRole('menu');
      expect(menu).toHaveAttribute('aria-label', 'Navigation menu');

      const menuItems = screen.getAllByRole('menuitem');
      menuItems.forEach(item => {
        expect(item).toHaveAttribute('aria-label');
      });
    });
  });

  describe('Security Features', () => {
    it('should log navigation events', () => {
      const mockLogNavigationEvent = jest.fn();
      (useAuth as jest.Mock).mockReturnValue({
        user: { role: UserRole.ADMIN, id: 'test-user' },
        logNavigationEvent: mockLogNavigationEvent
      });

      customRender(<Sidebar {...defaultProps} />);

      // Click navigation item
      fireEvent.click(screen.getByText('Dashboard'));

      expect(mockLogNavigationEvent).toHaveBeenCalledWith({
        destination: PRIVATE_ROUTES.DASHBOARD,
        itemId: 'dashboard',
        timestamp: expect.any(Date),
        userId: 'test-user'
      });
    });

    it('should prevent unauthorized access to restricted routes', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: { role: UserRole.OPERATOR },
        logNavigationEvent: jest.fn()
      });

      customRender(<Sidebar {...defaultProps} />);

      // Verify settings route is not accessible
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should render efficiently across viewport sizes', () => {
      const { rerender } = customRender(<Sidebar {...defaultProps} />);

      // Test mobile viewport
      (useMediaQuery as jest.Mock).mockReturnValue(true);
      rerender(<Sidebar {...defaultProps} />);
      expect(screen.getByRole('navigation')).toBeInTheDocument();

      // Test desktop viewport
      (useMediaQuery as jest.Mock).mockReturnValue(false);
      rerender(<Sidebar {...defaultProps} />);
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });
});