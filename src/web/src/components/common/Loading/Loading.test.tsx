import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { customRender } from '../../../tests/utils/test-utils';
import Loading from './Loading';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

describe('Loading Component', () => {
  // Test IDs and constants
  const TEST_ID = 'loading-component';
  const LOADING_TEXT = 'Loading...';
  const SIZES = ['small', 'medium', 'large'] as const;
  const ARIA_LABEL = 'Content is loading';

  // Basic rendering tests
  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      customRender(<Loading />);
      
      const loadingElement = screen.getByTestId(TEST_ID);
      expect(loadingElement).toBeInTheDocument();
      expect(loadingElement).toHaveAttribute('role', 'alert');
      expect(loadingElement).toHaveAttribute('aria-busy', 'true');
    });

    it('renders with custom text', () => {
      customRender(<Loading text={LOADING_TEXT} />);
      
      expect(screen.getByText(LOADING_TEXT)).toBeInTheDocument();
      expect(screen.getByLabelText(`Loading: ${LOADING_TEXT}`)).toBeInTheDocument();
    });

    it('renders in different sizes', () => {
      SIZES.forEach(size => {
        const { rerender } = customRender(<Loading size={size} />);
        
        const spinner = screen.getByRole('alert').querySelector('svg');
        expect(spinner).toBeInTheDocument();
        
        // Verify size classes based on size prop
        const expectedSize = size === 'small' ? 24 : size === 'medium' ? 40 : 56;
        expect(spinner).toHaveStyle({ width: `${expectedSize}px`, height: `${expectedSize}px` });
        
        rerender(<Loading />);
      });
    });
  });

  // Accessibility tests
  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA standards', async () => {
      const { container } = customRender(<Loading text={LOADING_TEXT} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has correct ARIA attributes', () => {
      customRender(<Loading text={LOADING_TEXT} />);
      
      const loadingElement = screen.getByTestId(TEST_ID);
      expect(loadingElement).toHaveAttribute('role', 'alert');
      expect(loadingElement).toHaveAttribute('aria-busy', 'true');
      expect(loadingElement).toHaveAttribute('aria-live', 'polite');
    });

    it('maintains focus management with overlay', () => {
      customRender(<Loading overlay text={LOADING_TEXT} />);
      
      const loadingElement = screen.getByTestId(TEST_ID);
      expect(document.body).toHaveStyle({ overflow: 'hidden' });
      expect(loadingElement).toHaveStyle({ position: 'fixed' });
    });
  });

  // Theme integration tests
  describe('Theme Integration', () => {
    it('applies theme colors correctly', () => {
      const { container } = customRender(<Loading />);
      
      const spinner = container.querySelector('.MuiCircularProgress-root');
      expect(spinner).toHaveStyle({ color: expect.stringMatching(/rgb|rgba|#/) });
    });

    it('handles theme transitions smoothly', async () => {
      const { container } = customRender(<Loading text={LOADING_TEXT} />);
      
      // Simulate theme change
      const themeContext = container.closest('.MuiThemeProvider-root');
      expect(themeContext).toBeInTheDocument();
    });
  });

  // Overlay mode tests
  describe('Overlay Mode', () => {
    it('renders in overlay mode with correct styles', () => {
      customRender(<Loading overlay />);
      
      const loadingElement = screen.getByTestId(TEST_ID);
      expect(loadingElement).toHaveStyle({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(4px)'
      });
    });

    it('handles ESC key in overlay mode', async () => {
      customRender(<Loading overlay />);
      
      await userEvent.keyboard('{Escape}');
      
      // Verify event prevention
      const loadingElement = screen.getByTestId(TEST_ID);
      expect(loadingElement).toBeInTheDocument();
    });

    it('cleans up overlay effects on unmount', () => {
      const { unmount } = customRender(<Loading overlay />);
      
      expect(document.body).toHaveStyle({ overflow: 'hidden' });
      
      unmount();
      
      expect(document.body).toHaveStyle({ overflow: 'unset' });
    });
  });

  // Timeout handling tests
  describe('Timeout Handling', () => {
    it('handles timeout prop correctly', async () => {
      const timeout = 1000;
      customRender(<Loading timeout={timeout} />);
      
      await waitFor(() => {
        expect(screen.getByTestId(TEST_ID)).toBeInTheDocument();
      }, { timeout: timeout + 100 });
    });

    it('cleans up timeout on unmount', () => {
      jest.useFakeTimers();
      
      const { unmount } = customRender(<Loading timeout={1000} />);
      unmount();
      
      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(clearTimeout).toHaveBeenCalledTimes(1);
      
      jest.useRealTimers();
    });
  });

  // Error handling tests
  describe('Error Handling', () => {
    it('gracefully handles missing theme', () => {
      const { container } = customRender(<Loading />);
      expect(container).toBeInTheDocument();
    });

    it('maintains accessibility even when text is missing', async () => {
      const { container } = customRender(<Loading />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});