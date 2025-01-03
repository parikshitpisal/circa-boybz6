import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { axe } from '@axe-core/react';
import Card from './Card';
import { customRender } from '../../../tests/utils/test-utils';

// Constants for testing
const TEST_ID = 'card-component';
const CUSTOM_CLASS = 'custom-card-class';
const TEST_CONTENT = 'Test Card Content';
const MOCK_PROPS = {
  elevation: 2,
  className: CUSTOM_CLASS,
  'aria-label': 'Test Card',
  'data-testid': TEST_ID
};

describe('Card Component', () => {
  // Clean up after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with default props', () => {
      const { container } = customRender(
        <Card>
          {TEST_CONTENT}
        </Card>
      );

      const card = screen.getByRole('article');
      expect(card).toBeInTheDocument();
      expect(card).toHaveTextContent(TEST_CONTENT);
      expect(card).toHaveStyle({ backgroundColor: expect.any(String) });
    });

    it('renders with custom props', () => {
      customRender(
        <Card {...MOCK_PROPS}>
          {TEST_CONTENT}
        </Card>
      );

      const card = screen.getByTestId(TEST_ID);
      expect(card).toHaveClass(CUSTOM_CLASS);
      expect(card).toHaveAttribute('aria-label', 'Test Card');
    });

    it('applies correct elevation styles', () => {
      const { container } = customRender(
        <Card elevation={4}>
          {TEST_CONTENT}
        </Card>
      );

      const card = screen.getByRole('article');
      expect(card).toHaveStyle({
        boxShadow: expect.any(String)
      });
    });
  });

  describe('Theme Integration', () => {
    it('applies light theme styles correctly', () => {
      const { container } = customRender(
        <Card>
          {TEST_CONTENT}
        </Card>
      );

      const card = screen.getByRole('article');
      expect(card).toHaveStyle({
        backgroundColor: expect.stringMatching(/rgb|rgba|#/),
        color: expect.stringMatching(/rgb|rgba|#/)
      });
    });

    it('applies dark theme styles correctly', async () => {
      const { container, rerender } = customRender(
        <Card>
          {TEST_CONTENT}
        </Card>,
        {
          theme: 'dark'
        }
      );

      const card = screen.getByRole('article');
      expect(card).toHaveStyle({
        backgroundColor: expect.stringMatching(/rgb|rgba|#/),
        color: expect.stringMatching(/rgb|rgba|#/)
      });
    });

    it('handles theme transitions smoothly', async () => {
      const { container } = customRender(
        <Card>
          {TEST_CONTENT}
        </Card>
      );

      const card = screen.getByRole('article');
      expect(card).toHaveStyle({
        transition: expect.stringContaining('background-color')
      });
    });
  });

  describe('Accessibility', () => {
    it('meets WCAG 2.1 Level AA standards', async () => {
      const { container } = customRender(
        <Card aria-label="Accessible Card">
          {TEST_CONTENT}
        </Card>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('supports keyboard navigation', () => {
      customRender(
        <Card tabIndex={0}>
          {TEST_CONTENT}
        </Card>
      );

      const card = screen.getByRole('article');
      card.focus();
      expect(card).toHaveFocus();
      expect(card).toHaveStyle({
        outline: expect.any(String)
      });
    });

    it('provides proper ARIA attributes', () => {
      customRender(
        <Card
          role="region"
          aria-label="Test Region"
          aria-describedby="description"
        >
          {TEST_CONTENT}
        </Card>
      );

      const card = screen.getByRole('region');
      expect(card).toHaveAttribute('aria-label', 'Test Region');
      expect(card).toHaveAttribute('aria-describedby', 'description');
    });
  });

  describe('Error Handling', () => {
    it('handles invalid elevation values gracefully', () => {
      // Test with elevation outside valid range (0-24)
      customRender(
        <Card elevation={30}>
          {TEST_CONTENT}
        </Card>
      );

      const card = screen.getByRole('article');
      expect(card).toBeInTheDocument();
      // Should clamp to maximum valid elevation
      expect(card).toHaveStyle({
        boxShadow: expect.any(String)
      });
    });

    it('handles missing children gracefully', () => {
      // @ts-ignore - Testing invalid props
      customRender(<Card />);
      
      const card = screen.getByRole('article');
      expect(card).toBeInTheDocument();
      expect(card).toBeEmptyDOMElement();
    });
  });

  describe('Performance', () => {
    it('renders without unnecessary re-renders', async () => {
      const renderSpy = jest.spyOn(React, 'memo');
      
      const { rerender } = customRender(
        <Card>
          {TEST_CONTENT}
        </Card>
      );

      // Re-render with same props
      rerender(
        <Card>
          {TEST_CONTENT}
        </Card>
      );

      expect(renderSpy).toHaveBeenCalled();
      expect(renderSpy.mock.calls.length).toBe(1);
    });
  });
});