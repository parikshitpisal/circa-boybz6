import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react';
import { screen, fireEvent, within } from '@testing-library/react';
import { Tabs, TabsProps } from './Tabs';
import { customRender } from '../../../tests/utils/test-utils';

// Test data constants
const TEST_TABS = [
  { label: 'Tab 1', content: 'Content 1', ariaLabel: 'First tab' },
  { label: 'Tab 2', content: 'Content 2', ariaLabel: 'Second tab' },
  { label: 'Tab 3', content: 'Content 3', ariaLabel: 'Third tab' }
];

const KEYBOARD_KEYS = {
  ARROW_RIGHT: '{ArrowRight}',
  ARROW_LEFT: '{ArrowLeft}',
  HOME: '{Home}',
  END: '{End}',
  ENTER: '{Enter}'
};

// Helper function to render tabs with theme support
const renderTabs = (props: Partial<TabsProps> = {}, themeMode: 'light' | 'dark' = 'light') => {
  const defaultProps: TabsProps = {
    tabs: TEST_TABS,
    defaultTab: 0,
    onChange: jest.fn(),
    ariaLabel: 'Test tabs',
    ...props
  };

  return customRender(<Tabs {...defaultProps} />, {
    theme: themeMode === 'light' ? 'lightTheme' : 'darkTheme'
  });
};

// Helper function for keyboard navigation testing
const setupKeyboardTest = async (props: TabsProps = { tabs: TEST_TABS }) => {
  const user = userEvent.setup();
  const { container } = renderTabs(props);
  const firstTab = screen.getByRole('tab', { name: TEST_TABS[0].label });
  await user.click(firstTab);
  return user;
};

describe('Tabs Component', () => {
  describe('Accessibility Compliance', () => {
    it('should pass axe accessibility tests', async () => {
      const { container } = renderTabs();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have correct ARIA roles and labels', () => {
      renderTabs();
      const tablist = screen.getByRole('tablist');
      const tabs = screen.getAllByRole('tab');
      const panels = screen.getAllByRole('tabpanel');

      expect(tablist).toHaveAttribute('aria-label', 'Test tabs');
      tabs.forEach((tab, index) => {
        expect(tab).toHaveAttribute('aria-controls', `tab-panel-${index}`);
        expect(tab).toHaveAttribute('aria-selected', index === 0 ? 'true' : 'false');
      });
      panels.forEach((panel, index) => {
        expect(panel).toHaveAttribute('aria-labelledby', `tab-${index}`);
      });
    });

    it('should handle focus management correctly', async () => {
      const user = await setupKeyboardTest();
      const tabs = screen.getAllByRole('tab');

      expect(document.activeElement).toBe(tabs[0]);
      await user.tab();
      expect(document.activeElement).toBe(tabs[1]);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate tabs with arrow keys', async () => {
      const user = await setupKeyboardTest();
      const tabs = screen.getAllByRole('tab');

      await user.keyboard(KEYBOARD_KEYS.ARROW_RIGHT);
      expect(document.activeElement).toBe(tabs[1]);
      
      await user.keyboard(KEYBOARD_KEYS.ARROW_LEFT);
      expect(document.activeElement).toBe(tabs[0]);
    });

    it('should handle Home/End keys', async () => {
      const user = await setupKeyboardTest();
      const tabs = screen.getAllByRole('tab');

      await user.keyboard(KEYBOARD_KEYS.END);
      expect(document.activeElement).toBe(tabs[tabs.length - 1]);

      await user.keyboard(KEYBOARD_KEYS.HOME);
      expect(document.activeElement).toBe(tabs[0]);
    });

    it('should skip disabled tabs during keyboard navigation', async () => {
      const tabsWithDisabled = TEST_TABS.map((tab, index) => ({
        ...tab,
        disabled: index === 1
      }));
      const user = await setupKeyboardTest({ tabs: tabsWithDisabled });
      const tabs = screen.getAllByRole('tab');

      await user.keyboard(KEYBOARD_KEYS.ARROW_RIGHT);
      expect(document.activeElement).toBe(tabs[2]);
    });
  });

  describe('Theme Integration', () => {
    it('should render with light theme styles', () => {
      renderTabs({}, 'light');
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveStyle({
        borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
      });
    });

    it('should render with dark theme styles', () => {
      renderTabs({}, 'dark');
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveStyle({
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
      });
    });

    it('should update styles on theme change', () => {
      const { rerender } = renderTabs({}, 'light');
      const tablist = screen.getByRole('tablist');
      
      rerender(<Tabs tabs={TEST_TABS} />, { theme: 'darkTheme' });
      expect(tablist).toHaveStyle({
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle empty tabs array gracefully', () => {
      renderTabs({ tabs: [] });
      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeEmptyDOMElement();
    });

    it('should handle invalid defaultTab index', () => {
      renderTabs({ defaultTab: 999 });
      const tabs = screen.getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('should handle tab change errors', () => {
      const onError = jest.fn();
      const onChange = jest.fn().mockImplementation(() => {
        throw new Error('Tab change error');
      });

      renderTabs({ onChange, onError });
      const secondTab = screen.getAllByRole('tab')[1];
      
      fireEvent.click(secondTab);
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should not re-render tab panels unnecessarily', () => {
      const renderSpy = jest.fn();
      const TabContent = React.memo(() => {
        renderSpy();
        return <div>Content</div>;
      });

      const tabs = TEST_TABS.map(tab => ({
        ...tab,
        content: <TabContent />
      }));

      renderTabs({ tabs });
      const initialRenderCount = renderSpy.mock.calls.length;
      
      const secondTab = screen.getAllByRole('tab')[1];
      fireEvent.click(secondTab);
      
      expect(renderSpy.mock.calls.length).toBe(initialRenderCount + 1);
    });

    it('should handle large number of tabs efficiently', () => {
      const manyTabs = Array.from({ length: 100 }, (_, i) => ({
        label: `Tab ${i}`,
        content: `Content ${i}`,
        ariaLabel: `Tab ${i}`
      }));

      const startTime = performance.now();
      renderTabs({ tabs: manyTabs });
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should render in under 100ms
    });
  });
});