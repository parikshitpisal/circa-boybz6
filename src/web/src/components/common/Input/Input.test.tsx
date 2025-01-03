import React from 'react';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, describe, it, jest } from '@jest/globals';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider, createTheme } from '@mui/material';
import Input from './Input';

expect.extend(toHaveNoViolations);

// Helper function to render Input with theme support
const renderInput = (props: Partial<IInputProps> = {}, themeMode: 'light' | 'dark' = 'light') => {
  const theme = createTheme({
    palette: {
      mode: themeMode,
    },
  });

  const defaultProps = {
    id: 'test-input',
    name: 'test',
    label: 'Test Input',
    value: '',
    onChange: jest.fn(),
  };

  const user = userEvent.setup();
  const utils = render(
    <ThemeProvider theme={theme}>
      <Input {...defaultProps} {...props} />
    </ThemeProvider>
  );

  return { ...utils, user };
};

describe('Input Component Functionality', () => {
  it('renders with required props', () => {
    renderInput();
    expect(screen.getByRole('textbox', { name: /test input/i })).toBeInTheDocument();
  });

  it('handles value changes with validation', async () => {
    const onChange = jest.fn();
    const { user } = renderInput({
      type: 'email',
      onChange,
    });

    const input = screen.getByRole('textbox');
    await user.type(input, 'test@example.com');

    expect(onChange).toHaveBeenCalledWith('test@example.com', true);
  });

  it('displays error state and message', () => {
    renderInput({
      error: 'Invalid input',
      'aria-invalid': true,
    });

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Invalid input')).toBeInTheDocument();
  });

  it('handles disabled state correctly', () => {
    renderInput({ disabled: true });
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('applies input masking for sensitive data', async () => {
    const { user } = renderInput({
      type: 'password',
      sensitive: true,
    });

    const input = screen.getByRole('textbox');
    await user.type(input, 'secret123');
    expect(input).toHaveValue('•••••••••');
  });

  it('debounces validation for performance', async () => {
    const onChange = jest.fn();
    const { user } = renderInput({
      onChange,
      validationRules: {
        minLength: 3,
      },
    });

    const input = screen.getByRole('textbox');
    await user.type(input, 'ab');
    
    // Should not validate immediately
    expect(onChange).not.toHaveBeenCalledWith('ab', false);
    
    // Should validate after debounce
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('ab', false);
    }, { timeout: 350 });
  });
});

describe('Accessibility Compliance', () => {
  it('meets WCAG 2.1 accessibility standards', async () => {
    const { container } = renderInput();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('supports keyboard navigation', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const { user } = renderInput({ onFocus, onBlur });

    const input = screen.getByRole('textbox');
    await user.tab();
    expect(input).toHaveFocus();
    expect(onFocus).toHaveBeenCalled();

    await user.tab();
    expect(input).not.toHaveFocus();
    expect(onBlur).toHaveBeenCalled();
  });

  it('provides appropriate ARIA labels', () => {
    renderInput({
      ariaLabel: 'Custom Label',
      ariaDescribedBy: 'helper-text',
      required: true,
    });

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-label', 'Custom Label');
    expect(input).toHaveAttribute('aria-describedby', 'helper-text');
    expect(input).toHaveAttribute('aria-required', 'true');
  });

  it('announces error messages to screen readers', async () => {
    const { rerender } = renderInput();
    const input = screen.getByRole('textbox');

    rerender(
      <Input
        id="test-input"
        name="test"
        label="Test Input"
        value=""
        onChange={jest.fn()}
        error="Invalid input"
      />
    );

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Invalid input')).toHaveAttribute('id', expect.stringMatching(/helper-text/));
  });
});

describe('Theme Integration', () => {
  it('applies light theme styles correctly', () => {
    renderInput({}, 'light');
    const input = screen.getByRole('textbox').closest('.MuiOutlinedInput-root');
    expect(input).toHaveStyle({
      backgroundColor: expect.stringMatching(/rgba\(0, 0, 0, 0\)/),
    });
  });

  it('applies dark theme styles correctly', () => {
    renderInput({}, 'dark');
    const input = screen.getByRole('textbox').closest('.MuiOutlinedInput-root');
    expect(input).toHaveStyle({
      backgroundColor: expect.stringMatching(/rgba\(255, 255, 255, 0.05\)/),
    });
  });

  it('maintains focus indicators in both themes', async () => {
    const { user, rerender } = renderInput({}, 'light');
    let input = screen.getByRole('textbox');

    await user.click(input);
    expect(input.closest('.MuiOutlinedInput-root')).toHaveClass('Mui-focused');

    rerender(
      <ThemeProvider theme={createTheme({ palette: { mode: 'dark' } })}>
        <Input
          id="test-input"
          name="test"
          label="Test Input"
          value=""
          onChange={jest.fn()}
        />
      </ThemeProvider>
    );

    input = screen.getByRole('textbox');
    await user.click(input);
    expect(input.closest('.MuiOutlinedInput-root')).toHaveClass('Mui-focused');
  });
});

describe('Security Features', () => {
  it('prevents XSS in input values', async () => {
    const onChange = jest.fn();
    const { user } = renderInput({ onChange });

    const input = screen.getByRole('textbox');
    await user.type(input, '<script>alert("xss")</script>');

    expect(onChange).toHaveBeenCalledWith('scriptalert("xss")/script', expect.any(Boolean));
  });

  it('handles sensitive data with appropriate security measures', async () => {
    const { user } = renderInput({
      type: 'ssn',
      sensitive: true,
    });

    const input = screen.getByRole('textbox');
    await user.type(input, '123-45-6789');

    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
    expect(input.closest('.MuiInputBase-root')).toHaveStyle({
      caretColor: 'transparent',
    });
  });

  it('validates EIN format correctly', async () => {
    const onChange = jest.fn();
    const { user } = renderInput({
      type: 'ein',
      onChange,
    });

    const input = screen.getByRole('textbox');
    await user.type(input, '12-3456789');

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('12-3456789', true);
    });
  });

  it('validates SSN format correctly', async () => {
    const onChange = jest.fn();
    const { user } = renderInput({
      type: 'ssn',
      onChange,
    });

    const input = screen.getByRole('textbox');
    await user.type(input, '123-45-6789');

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith('123-45-6789', true);
    });
  });
});