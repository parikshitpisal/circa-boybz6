import React from 'react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react'; // v4.7.0
import Alert from './Alert';
import { customRender, screen, fireEvent } from '../../../tests/utils/test-utils';

describe('Alert Component', () => {
  // Set up fake timers for auto-hide testing
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  // Basic Rendering Tests
  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      customRender(<Alert message="Test message" />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Test message');
      expect(alert).toHaveClass('MuiAlert-standardInfo'); // Default severity
    });

    it('renders with custom severity', () => {
      customRender(<Alert message="Success message" severity="success" />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-standardSuccess');
    });

    it('renders with custom variant', () => {
      customRender(<Alert message="Warning message" severity="warning" variant="filled" />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-filled');
      expect(alert).toHaveClass('MuiAlert-filledWarning');
    });
  });

  // Theme Integration Tests
  describe('Theme Integration', () => {
    it('applies correct theme-based styles', () => {
      const { container } = customRender(
        <Alert message="Themed message" severity="error" />
      );
      
      const alert = container.firstChild as HTMLElement;
      const styles = window.getComputedStyle(alert);
      
      expect(styles.marginBottom).toBe('16px'); // theme.spacing(2)
      expect(styles.boxShadow).toBeTruthy(); // theme-based shadow
    });

    it('handles theme-based icon spacing', () => {
      const { container } = customRender(
        <Alert message="Icon spacing test" />
      );
      
      const icon = container.querySelector('.MuiAlert-icon');
      const styles = window.getComputedStyle(icon as Element);
      
      expect(styles.marginRight).toBe('8px'); // theme.spacing(1)
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('meets WCAG 2.1 accessibility standards', async () => {
      const { container } = customRender(
        <Alert message="Accessibility test message" />
      );
      
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has correct ARIA attributes', () => {
      customRender(<Alert message="ARIA test message" />);
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveAttribute('aria-live', 'polite');
      expect(alert).toHaveAttribute('aria-atomic', 'true');
    });

    it('supports keyboard navigation for close button', () => {
      const handleClose = jest.fn();
      customRender(
        <Alert message="Keyboard test" onClose={handleClose} />
      );
      
      const closeButton = screen.getByLabelText('Close alert');
      closeButton.focus();
      fireEvent.keyDown(closeButton, { key: 'Enter' });
      
      expect(handleClose).toHaveBeenCalled();
    });
  });

  // Auto-hide Functionality Tests
  describe('Auto-hide Functionality', () => {
    it('auto-hides after specified duration', () => {
      const handleClose = jest.fn();
      customRender(
        <Alert 
          message="Auto-hide test" 
          onClose={handleClose} 
          autoHideDuration={3000} 
        />
      );
      
      expect(handleClose).not.toHaveBeenCalled();
      jest.advanceTimersByTime(3000);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('cleans up timer on unmount', () => {
      const handleClose = jest.fn();
      const { unmount } = customRender(
        <Alert 
          message="Cleanup test" 
          onClose={handleClose} 
          autoHideDuration={3000} 
        />
      );
      
      unmount();
      jest.advanceTimersByTime(3000);
      expect(handleClose).not.toHaveBeenCalled();
    });
  });

  // Close Button Tests
  describe('Close Button', () => {
    it('renders close button when onClose provided', () => {
      const handleClose = jest.fn();
      customRender(
        <Alert message="Close button test" onClose={handleClose} />
      );
      
      expect(screen.getByLabelText('Close alert')).toBeInTheDocument();
    });

    it('handles close button click', async () => {
      const handleClose = jest.fn();
      customRender(
        <Alert message="Click test" onClose={handleClose} />
      );
      
      const closeButton = screen.getByLabelText('Close alert');
      await userEvent.click(closeButton);
      
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('does not render close button when onClose not provided', () => {
      customRender(<Alert message="No close button test" />);
      
      expect(screen.queryByLabelText('Close alert')).not.toBeInTheDocument();
    });
  });

  // Different Alert States Tests
  describe('Alert States', () => {
    it('renders success alert with correct styling', () => {
      customRender(
        <Alert message="Success test" severity="success" variant="filled" />
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-filledSuccess');
    });

    it('renders error alert with correct styling', () => {
      customRender(
        <Alert message="Error test" severity="error" variant="outlined" />
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-outlinedError');
    });

    it('renders warning alert with correct styling', () => {
      customRender(
        <Alert message="Warning test" severity="warning" />
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-standardWarning');
    });

    it('renders info alert with correct styling', () => {
      customRender(
        <Alert message="Info test" severity="info" />
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('MuiAlert-standardInfo');
    });
  });
});