import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { Dropdown } from './Dropdown';
import { customRender, screen, fireEvent } from '../../../tests/utils/test-utils';

// Mock functions for event handlers
const mockOnChange = jest.fn();
const mockOnBlur = jest.fn();
const mockOnSearch = jest.fn();

// Default test props
const defaultProps = {
  name: 'test-dropdown',
  id: 'test-dropdown',
  label: 'Test Dropdown',
  value: '',
  options: [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' }
  ],
  onChange: mockOnChange,
  'aria-label': 'Select an option',
  required: false,
  error: '',
  disabled: false,
  multiple: false
};

// Helper function to generate large option sets for performance testing
const generateLargeOptionSet = (count: number) => 
  Array.from({ length: count }, (_, i) => ({
    value: `${i + 1}`,
    label: `Option ${i + 1}`
  }));

describe('Dropdown Component', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders with correct label and ARIA attributes', () => {
      customRender(<Dropdown {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      expect(dropdown).toBeInTheDocument();
      expect(dropdown).toHaveAttribute('aria-label', 'Test Dropdown');
      expect(dropdown).toHaveAttribute('id', 'test-dropdown');
    });

    it('applies proper theme styling', () => {
      const { container } = customRender(<Dropdown {...defaultProps} />);
      
      const dropdown = container.querySelector('.MuiSelect-root');
      expect(dropdown).toHaveStyle({
        width: '100%',
        borderRadius: '4px'
      });
    });

    it('displays placeholder when no value is selected', () => {
      customRender(<Dropdown {...defaultProps} placeholder="Select option" />);
      
      expect(screen.getByText('Select option')).toBeInTheDocument();
    });

    it('renders with error state and message', () => {
      customRender(
        <Dropdown {...defaultProps} error="Required field" required={true} />
      );
      
      const dropdown = screen.getByRole('combobox');
      const errorMessage = screen.getByText('Required field');
      
      expect(dropdown).toHaveAttribute('aria-invalid', 'true');
      expect(errorMessage).toBeInTheDocument();
      expect(errorMessage).toHaveAttribute('role', 'alert');
    });
  });

  describe('Interaction', () => {
    it('opens options list on click', async () => {
      customRender(<Dropdown {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      await userEvent.click(dropdown);
      
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(defaultProps.options.length);
    });

    it('handles single selection correctly', async () => {
      customRender(<Dropdown {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      await userEvent.click(dropdown);
      await userEvent.click(screen.getByText('Option 1'));
      
      expect(mockOnChange).toHaveBeenCalledWith('1');
      expect(dropdown).toHaveTextContent('Option 1');
    });

    it('handles multiple selection correctly', async () => {
      customRender(<Dropdown {...defaultProps} multiple value={[]} />);
      
      const dropdown = screen.getByRole('listbox');
      await userEvent.click(dropdown);
      await userEvent.click(screen.getByText('Option 1'));
      await userEvent.click(screen.getByText('Option 2'));
      
      expect(mockOnChange).toHaveBeenCalledWith(['1', '2']);
    });

    it('supports search functionality', async () => {
      customRender(<Dropdown {...defaultProps} searchable onSearch={mockOnSearch} />);
      
      const dropdown = screen.getByRole('combobox');
      await userEvent.click(dropdown);
      
      const searchInput = screen.getByPlaceholderText('Search options...');
      await userEvent.type(searchInput, 'Option 1');
      
      expect(mockOnSearch).toHaveBeenCalledWith('Option 1');
    });
  });

  describe('Accessibility', () => {
    it('supports keyboard navigation', async () => {
      customRender(<Dropdown {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      dropdown.focus();
      
      // Open dropdown with keyboard
      fireEvent.keyDown(dropdown, { key: 'Enter' });
      expect(screen.getAllByRole('option')).toHaveLength(defaultProps.options.length);
      
      // Navigate with arrow keys
      fireEvent.keyDown(dropdown, { key: 'ArrowDown' });
      expect(screen.getByText('Option 1')).toHaveAttribute('aria-selected', 'true');
    });

    it('announces state changes to screen readers', async () => {
      customRender(<Dropdown {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      await userEvent.click(dropdown);
      await userEvent.click(screen.getByText('Option 1'));
      
      const announcement = screen.getByRole('status');
      expect(announcement).toHaveAttribute('aria-label', 'Selected: Option 1');
    });

    it('maintains focus management', async () => {
      customRender(<Dropdown {...defaultProps} />);
      
      const dropdown = screen.getByRole('combobox');
      dropdown.focus();
      expect(document.activeElement).toBe(dropdown);
      
      fireEvent.keyDown(dropdown, { key: 'Enter' });
      fireEvent.keyDown(dropdown, { key: 'Escape' });
      expect(document.activeElement).toBe(dropdown);
    });
  });

  describe('Performance', () => {
    it('handles large option lists efficiently', async () => {
      const largeOptions = generateLargeOptionSet(1000);
      const startTime = performance.now();
      
      customRender(
        <Dropdown
          {...defaultProps}
          options={largeOptions}
          virtualScroll
          maxHeight={300}
        />
      );
      
      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(100); // Should render in under 100ms
      
      const dropdown = screen.getByRole('combobox');
      await userEvent.click(dropdown);
      
      // Check that virtualization is working
      const visibleOptions = screen.getAllByRole('option');
      expect(visibleOptions.length).toBeLessThan(largeOptions.length);
    });

    it('optimizes search performance', async () => {
      const largeOptions = generateLargeOptionSet(1000);
      
      customRender(
        <Dropdown
          {...defaultProps}
          options={largeOptions}
          searchable
          onSearch={mockOnSearch}
        />
      );
      
      const dropdown = screen.getByRole('combobox');
      await userEvent.click(dropdown);
      
      const searchInput = screen.getByPlaceholderText('Search options...');
      const startTime = performance.now();
      
      await userEvent.type(searchInput, 'Option 500');
      
      const searchTime = performance.now() - startTime;
      expect(searchTime).toBeLessThan(50); // Search should complete in under 50ms
    });
  });

  describe('Validation', () => {
    it('handles required field validation', async () => {
      customRender(
        <Dropdown {...defaultProps} required error="This field is required" />
      );
      
      const dropdown = screen.getByRole('combobox');
      await userEvent.click(dropdown);
      await userEvent.tab();
      
      expect(mockOnBlur).toHaveBeenCalled();
      expect(screen.getByText('This field is required')).toBeInTheDocument();
    });

    it('supports custom validation rules', async () => {
      const validateSelection = (value: string) => 
        value === '2' ? 'Option 2 is not allowed' : '';
      
      customRender(
        <Dropdown
          {...defaultProps}
          error={validateSelection(defaultProps.value)}
          onChange={(value) => {
            const error = validateSelection(value as string);
            mockOnChange(value, error);
          }}
        />
      );
      
      const dropdown = screen.getByRole('combobox');
      await userEvent.click(dropdown);
      await userEvent.click(screen.getByText('Option 2'));
      
      expect(screen.getByText('Option 2 is not allowed')).toBeInTheDocument();
    });
  });
});