import React from 'react';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Dialog } from './Dialog';
import { customRender } from '../../../tests/utils/test-utils';

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockImplementation(() => ({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null
}));
window.IntersectionObserver = mockIntersectionObserver;

describe('Dialog Component', () => {
  // Mock handlers
  const onCloseMock = jest.fn();
  const onActionMock = jest.fn();

  // Default test props
  const defaultProps = {
    open: true,
    title: 'Test Dialog',
    onClose: onCloseMock,
    children: <div>Test Content</div>,
    actions: [
      { label: 'Cancel', onClick: onActionMock, variant: 'outlined' },
      { label: 'Confirm', onClick: onActionMock, variant: 'contained' }
    ]
  };

  beforeEach(() => {
    // Reset mocks before each test
    onCloseMock.mockReset();
    onActionMock.mockReset();
    // Reset body style
    document.body.style.overflow = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering and Visibility', () => {
    it('should render dialog when open is true', () => {
      customRender(<Dialog {...defaultProps} />);
      
      expect(screen.getByRole('dialog')).toBeVisible();
      expect(screen.getByText('Test Dialog')).toBeVisible();
      expect(screen.getByText('Test Content')).toBeVisible();
    });

    it('should not render dialog when open is false', () => {
      customRender(<Dialog {...defaultProps} open={false} />);
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render with custom maxWidth', () => {
      customRender(<Dialog {...defaultProps} maxWidth="md" />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveClass('MuiDialog-paperWidthMd');
    });

    it('should prevent body scroll when open', () => {
      customRender(<Dialog {...defaultProps} />);
      
      expect(document.body.style.overflow).toBe('hidden');
    });
  });

  describe('Accessibility Compliance', () => {
    it('should have correct ARIA attributes', () => {
      customRender(<Dialog {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');
    });

    it('should manage focus correctly', () => {
      customRender(<Dialog {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      expect(document.activeElement).toBe(dialog);
    });

    it('should support keyboard navigation', async () => {
      customRender(<Dialog {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      
      await userEvent.tab();
      expect(buttons[0]).toHaveFocus();
      
      await userEvent.tab();
      expect(buttons[1]).toHaveFocus();
    });

    it('should close on escape key press', () => {
      customRender(<Dialog {...defaultProps} />);
      
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Theme Compatibility', () => {
    it('should render with light theme styles', () => {
      const { container } = customRender(<Dialog {...defaultProps} />);
      
      const dialogPaper = container.querySelector('.MuiDialog-paper');
      expect(dialogPaper).toHaveStyle({
        borderRadius: '8px',
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)'
      });
    });

    it('should render with dark theme styles', () => {
      const { container } = customRender(
        <Dialog {...defaultProps} />,
        { theme: 'dark' }
      );
      
      const dialogPaper = container.querySelector('.MuiDialog-paper');
      expect(dialogPaper).toHaveStyle({
        backgroundColor: '#1e1e1e'
      });
    });

    it('should maintain consistent spacing across themes', () => {
      const { container } = customRender(<Dialog {...defaultProps} />);
      
      const dialogTitle = container.querySelector('.MuiDialogTitle-root');
      const dialogContent = container.querySelector('.MuiDialogContent-root');
      const dialogActions = container.querySelector('.MuiDialogActions-root');
      
      expect(dialogTitle).toHaveStyle({ padding: '16px 24px' });
      expect(dialogContent).toHaveStyle({ padding: '16px 24px' });
      expect(dialogActions).toHaveStyle({ padding: '16px 24px' });
    });
  });

  describe('User Interactions', () => {
    it('should call onClose when backdrop is clicked', () => {
      customRender(<Dialog {...defaultProps} />);
      
      const backdrop = screen.getByRole('presentation').firstChild;
      fireEvent.click(backdrop as Element);
      
      expect(onCloseMock).toHaveBeenCalledTimes(1);
    });

    it('should handle action button clicks', async () => {
      customRender(<Dialog {...defaultProps} />);
      
      const buttons = screen.getAllByRole('button');
      await userEvent.click(buttons[0]); // Cancel button
      await userEvent.click(buttons[1]); // Confirm button
      
      expect(onActionMock).toHaveBeenCalledTimes(2);
    });

    it('should maintain focus trap within dialog', async () => {
      customRender(<Dialog {...defaultProps} />);
      
      const dialog = screen.getByRole('dialog');
      const buttons = screen.getAllByRole('button');
      
      await userEvent.tab();
      expect(buttons[0]).toHaveFocus();
      
      // Tab through all focusable elements
      for (let i = 0; i < buttons.length + 2; i++) {
        await userEvent.tab();
      }
      
      // Should cycle back to first button
      expect(buttons[0]).toHaveFocus();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large content without breaking layout', () => {
      const largeContent = 'x'.repeat(10000);
      customRender(
        <Dialog {...defaultProps}>
          <div>{largeContent}</div>
        </Dialog>
      );
      
      const dialogContent = screen.getByRole('dialog');
      expect(dialogContent).toBeVisible();
      expect(dialogContent).toHaveStyle({ overflowY: 'auto' });
    });

    it('should cleanup body style on unmount', () => {
      const { unmount } = customRender(<Dialog {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');
      
      unmount();
      expect(document.body.style.overflow).toBe('unset');
    });

    it('should handle rapid open/close transitions', () => {
      const { rerender } = customRender(<Dialog {...defaultProps} />);
      
      // Rapidly toggle open state
      for (let i = 0; i < 5; i++) {
        rerender(<Dialog {...defaultProps} open={false} />);
        rerender(<Dialog {...defaultProps} open={true} />);
      }
      
      expect(screen.getByRole('dialog')).toBeVisible();
      expect(document.body.style.overflow).toBe('hidden');
    });
  });
});