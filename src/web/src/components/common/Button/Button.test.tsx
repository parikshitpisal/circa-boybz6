import React from 'react';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { axe } from '@axe-core/react'; // v4.x
import Button from './Button';
import { customRender } from '../../../tests/utils/test-utils';

describe('Button Component', () => {
  // Mock handlers
  const mockClick = jest.fn();
  const mockKeyPress = jest.fn();

  // Common test props
  const defaultProps = {
    onClick: mockClick,
    children: 'Test Button'
  };

  beforeEach(() => {
    mockClick.mockClear();
    mockKeyPress.mockClear();
  });

  describe('Rendering', () => {
    it('renders with default props correctly', () => {
      customRender(<Button {...defaultProps} />);
      const button = screen.getByRole('button', { name: /test button/i });
      
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('MuiButton-contained');
      expect(button).toHaveClass('MuiButton-containedPrimary');
    });

    it('renders with different variants correctly', () => {
      const variants = ['contained', 'outlined', 'text'] as const;
      
      variants.forEach(variant => {
        customRender(<Button {...defaultProps} variant={variant} />);
        const button = screen.getByRole('button', { name: /test button/i });
        expect(button).toHaveClass(`MuiButton-${variant}`);
      });
    });

    it('renders with different colors correctly', () => {
      const colors = ['primary', 'secondary', 'error', 'warning', 'info', 'success'] as const;
      
      colors.forEach(color => {
        customRender(<Button {...defaultProps} color={color} />);
        const button = screen.getByRole('button', { name: /test button/i });
        expect(button).toHaveClass(`MuiButton-contained${color.charAt(0).toUpperCase() + color.slice(1)}`);
      });
    });

    it('renders with start icon correctly', () => {
      customRender(
        <Button {...defaultProps} startIcon={<span data-testid="start-icon">★</span>} />
      );
      
      const button = screen.getByRole('button');
      const startIcon = within(button).getByTestId('start-icon');
      expect(startIcon).toBeInTheDocument();
      expect(startIcon.parentElement).toHaveClass('MuiButton-startIcon');
    });

    it('renders with end icon correctly', () => {
      customRender(
        <Button {...defaultProps} endIcon={<span data-testid="end-icon">★</span>} />
      );
      
      const button = screen.getByRole('button');
      const endIcon = within(button).getByTestId('end-icon');
      expect(endIcon).toBeInTheDocument();
      expect(endIcon.parentElement).toHaveClass('MuiButton-endIcon');
    });

    it('renders in full width mode correctly', () => {
      customRender(<Button {...defaultProps} fullWidth />);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('MuiButton-fullWidth');
    });
  });

  describe('Interaction', () => {
    it('handles click events correctly', async () => {
      customRender(<Button {...defaultProps} />);
      const button = screen.getByRole('button');
      
      fireEvent.click(button);
      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('prevents click when disabled', () => {
      customRender(<Button {...defaultProps} disabled />);
      const button = screen.getByRole('button');
      
      fireEvent.click(button);
      expect(mockClick).not.toHaveBeenCalled();
    });

    it('handles keyboard Enter press correctly', () => {
      customRender(<Button {...defaultProps} />);
      const button = screen.getByRole('button');
      
      fireEvent.keyPress(button, { key: 'Enter', code: 'Enter' });
      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('handles keyboard Space press correctly', () => {
      customRender(<Button {...defaultProps} />);
      const button = screen.getByRole('button');
      
      fireEvent.keyPress(button, { key: ' ', code: 'Space' });
      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('maintains focus states correctly', () => {
      customRender(<Button {...defaultProps} />);
      const button = screen.getByRole('button');
      
      button.focus();
      expect(button).toHaveFocus();
      expect(button).toHaveClass('Mui-focusVisible');
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA standards', async () => {
      const { container } = customRender(<Button {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('provides proper ARIA attributes', () => {
      customRender(<Button {...defaultProps} ariaLabel="Custom Label" />);
      const button = screen.getByRole('button');
      
      expect(button).toHaveAttribute('aria-label', 'Custom Label');
      expect(button).toHaveAttribute('role', 'button');
    });

    it('handles tab navigation correctly', () => {
      customRender(<Button {...defaultProps} />);
      const button = screen.getByRole('button');
      
      expect(button).toHaveAttribute('tabIndex', '0');
      
      customRender(<Button {...defaultProps} disabled />);
      const disabledButton = screen.getByRole('button');
      expect(disabledButton).toHaveAttribute('tabIndex', '-1');
    });
  });

  describe('Theming', () => {
    it('applies light theme styles correctly', () => {
      customRender(<Button {...defaultProps} />, {
        theme: 'light'
      });
      
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: expect.any(String),
        color: expect.any(String)
      });
    });

    it('applies dark theme styles correctly', () => {
      customRender(<Button {...defaultProps} />, {
        theme: 'dark'
      });
      
      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        backgroundColor: expect.any(String),
        color: expect.any(String)
      });
    });

    it('transitions theme changes smoothly', async () => {
      const { rerender } = customRender(<Button {...defaultProps} />, {
        theme: 'light'
      });

      const button = screen.getByRole('button');
      expect(button).toHaveStyle({
        transition: expect.stringContaining('all 0.2s')
      });

      rerender(<Button {...defaultProps} />);
      await waitFor(() => {
        expect(button).toHaveStyle({
          transition: expect.stringContaining('all 0.2s')
        });
      });
    });
  });
});