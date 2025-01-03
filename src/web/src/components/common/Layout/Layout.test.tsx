import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';

import Layout from './Layout';
import { customRender } from '../../../tests/utils/test-utils';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Test constants
const TEST_ID = 'layout-container';
const BREAKPOINTS = {
  MOBILE: 320,
  TABLET: 768,
  DESKTOP: 1024,
  LARGE_DESKTOP: 1440
};
const MOCK_CONTENT = <div>Test content for layout verification</div>;

describe('Layout Component', () => {
  // Mock window resize
  const originalInnerWidth = window.innerWidth;
  const resizeWindow = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: width
    });
    window.dispatchEvent(new Event('resize'));
  };

  // Reset window size after each test
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth
    });
  });

  describe('Responsive Design', () => {
    it('should render correctly at mobile breakpoint', () => {
      resizeWindow(BREAKPOINTS.MOBILE);
      const { container } = customRender(
        <Layout maxWidth="lg">{MOCK_CONTENT}</Layout>
      );
      
      expect(container.firstChild).toHaveStyle({
        paddingLeft: '16px',
        paddingRight: '16px'
      });
    });

    it('should render correctly at tablet breakpoint', () => {
      resizeWindow(BREAKPOINTS.TABLET);
      const { container } = customRender(
        <Layout maxWidth="lg">{MOCK_CONTENT}</Layout>
      );
      
      expect(container.firstChild).toHaveStyle({
        paddingLeft: '24px',
        paddingRight: '24px'
      });
    });

    it('should render correctly at desktop breakpoint', () => {
      resizeWindow(BREAKPOINTS.DESKTOP);
      const { container } = customRender(
        <Layout maxWidth="lg">{MOCK_CONTENT}</Layout>
      );
      
      expect(container.firstChild).toHaveStyle({
        paddingLeft: '32px',
        paddingRight: '32px'
      });
    });

    it('should adjust grid spacing based on viewport', () => {
      resizeWindow(BREAKPOINTS.MOBILE);
      const { rerender } = customRender(
        <Layout maxWidth="lg" spacing={3}>{MOCK_CONTENT}</Layout>
      );
      
      expect(screen.getByRole('main')).toHaveStyle({
        gap: '16px'
      });

      resizeWindow(BREAKPOINTS.DESKTOP);
      rerender(<Layout maxWidth="lg" spacing={3}>{MOCK_CONTENT}</Layout>);
      
      expect(screen.getByRole('main')).toHaveStyle({
        gap: '24px'
      });
    });
  });

  describe('Theme Support', () => {
    it('should apply correct theme styles in light mode', () => {
      const { container } = customRender(
        <Layout maxWidth="lg">{MOCK_CONTENT}</Layout>,
        {
          theme: 'light'
        }
      );

      expect(container.firstChild).toHaveStyle({
        backgroundColor: '#ffffff'
      });
    });

    it('should apply correct theme styles in dark mode', () => {
      const { container } = customRender(
        <Layout maxWidth="lg">{MOCK_CONTENT}</Layout>,
        {
          theme: 'dark'
        }
      );

      expect(container.firstChild).toHaveStyle({
        backgroundColor: '#121212'
      });
    });

    it('should maintain proper contrast ratios in both themes', async () => {
      const { container: lightContainer } = customRender(
        <Layout maxWidth="lg">{MOCK_CONTENT}</Layout>,
        {
          theme: 'light'
        }
      );
      
      const lightResults = await axe(lightContainer);
      expect(lightResults).toHaveNoViolations();

      const { container: darkContainer } = customRender(
        <Layout maxWidth="lg">{MOCK_CONTENT}</Layout>,
        {
          theme: 'dark'
        }
      );
      
      const darkResults = await axe(darkContainer);
      expect(darkResults).toHaveNoViolations();
    });
  });

  describe('Accessibility', () => {
    it('should have correct ARIA attributes', () => {
      const testLabel = 'Main content area';
      customRender(
        <Layout 
          maxWidth="lg" 
          role="main" 
          aria-label={testLabel}
        >
          {MOCK_CONTENT}
        </Layout>
      );

      const mainElement = screen.getByRole('main');
      expect(mainElement).toHaveAttribute('aria-label', testLabel);
    });

    it('should maintain proper focus management', async () => {
      const user = userEvent.setup();
      customRender(
        <Layout maxWidth="lg">
          <button>First Button</button>
          <button>Second Button</button>
        </Layout>
      );

      const buttons = screen.getAllByRole('button');
      
      // Test keyboard navigation
      await user.tab();
      expect(buttons[0]).toHaveFocus();
      
      await user.tab();
      expect(buttons[1]).toHaveFocus();
    });

    it('should be navigable by screen readers', () => {
      customRender(
        <Layout maxWidth="lg">
          <section aria-label="Section 1">Content 1</section>
          <section aria-label="Section 2">Content 2</section>
        </Layout>
      );

      const sections = screen.getAllByRole('region');
      expect(sections).toHaveLength(2);
      expect(sections[0]).toHaveAttribute('aria-label', 'Section 1');
      expect(sections[1]).toHaveAttribute('aria-label', 'Section 2');
    });

    it('should pass comprehensive accessibility audit', async () => {
      const { container } = customRender(
        <Layout maxWidth="lg">
          <h1>Page Title</h1>
          <nav aria-label="Main navigation">
            <ul>
              <li><a href="#section1">Section 1</a></li>
              <li><a href="#section2">Section 2</a></li>
            </ul>
          </nav>
          <main>
            <section id="section1" aria-labelledby="heading1">
              <h2 id="heading1">Section 1 Heading</h2>
              <p>Section 1 content</p>
            </section>
            <section id="section2" aria-labelledby="heading2">
              <h2 id="heading2">Section 2 Heading</h2>
              <p>Section 2 content</p>
            </section>
          </main>
        </Layout>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Props and Configuration', () => {
    it('should apply custom maxWidth correctly', () => {
      const { container } = customRender(
        <Layout maxWidth="sm">{MOCK_CONTENT}</Layout>
      );
      
      expect(container.firstChild).toHaveClass('MuiContainer-maxWidthSm');
    });

    it('should apply custom spacing correctly', () => {
      const { container } = customRender(
        <Layout maxWidth="lg" spacing={4}>{MOCK_CONTENT}</Layout>
      );
      
      const grid = container.querySelector('.MuiGrid-container');
      expect(grid).toHaveStyle({
        gap: '32px'
      });
    });

    it('should handle undefined props gracefully', () => {
      const { container } = customRender(
        <Layout>{MOCK_CONTENT}</Layout>
      );
      
      expect(container.firstChild).toHaveClass('MuiContainer-maxWidthLg');
      const grid = container.querySelector('.MuiGrid-container');
      expect(grid).toHaveStyle({
        gap: '24px'
      });
    });
  });

  describe('Performance', () => {
    it('should render efficiently without unnecessary updates', () => {
      const renderCount = jest.fn();
      const TestComponent = () => {
        renderCount();
        return <div>Test content</div>;
      };

      const { rerender } = customRender(
        <Layout maxWidth="lg">
          <TestComponent />
        </Layout>
      );

      // Rerender with same props
      rerender(
        <Layout maxWidth="lg">
          <TestComponent />
        </Layout>
      );

      expect(renderCount).toHaveBeenCalledTimes(1);
    });
  });
});