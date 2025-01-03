import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TextField } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useDebounce } from 'use-debounce';
import { validateEIN, validateSSN } from '../../utils/validation.utils';

/**
 * Enhanced props interface for Input component with security and accessibility features
 */
interface IInputProps {
  id: string;
  name: string;
  label: string;
  value: string;
  type?: 'text' | 'password' | 'email' | 'tel' | 'number' | 'ein' | 'ssn';
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  sensitive?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  validationRules?: {
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    customValidator?: (value: string) => boolean;
  };
  onChange: (value: string, isValid: boolean) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
}

/**
 * Enhanced input component with security, accessibility, and validation features
 * Implements WCAG 2.1 Level AA compliance and secure data handling
 */
const Input: React.FC<IInputProps> = React.memo(({
  id,
  name,
  label,
  value,
  type = 'text',
  placeholder,
  error,
  disabled = false,
  required = false,
  sensitive = false,
  ariaLabel,
  ariaDescribedBy,
  validationRules,
  onChange,
  onBlur,
  onFocus
}) => {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const [localError, setLocalError] = useState(error);
  const [debouncedValue] = useDebounce(localValue, 300);

  // Mask sensitive data display
  const maskValue = useCallback((val: string): string => {
    if (!sensitive) return val;
    return val.replace(/./g, '•');
  }, [sensitive]);

  // Sanitize input value to prevent XSS
  const sanitizeInput = useCallback((val: string): string => {
    return val.replace(/[<>]/g, '');
  }, []);

  // Validate input based on type and rules
  const validateInput = useCallback((val: string): { isValid: boolean; error?: string } => {
    if (!val && required) {
      return { isValid: false, error: `${label} is required` };
    }

    if (validationRules?.pattern && !validationRules.pattern.test(val)) {
      return { isValid: false, error: `Invalid ${label.toLowerCase()} format` };
    }

    if (validationRules?.minLength && val.length < validationRules.minLength) {
      return { isValid: false, error: `${label} must be at least ${validationRules.minLength} characters` };
    }

    if (validationRules?.maxLength && val.length > validationRules.maxLength) {
      return { isValid: false, error: `${label} must not exceed ${validationRules.maxLength} characters` };
    }

    switch (type) {
      case 'ein':
        return validateEIN(val);
      case 'ssn':
        return validateSSN(val);
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return { isValid: emailRegex.test(val), error: !emailRegex.test(val) ? 'Invalid email format' : undefined };
      default:
        return { isValid: true };
    }
  }, [label, required, type, validationRules]);

  // Handle input change with validation
  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = sanitizeInput(event.target.value);
    setLocalValue(sanitizedValue);
    
    const validation = validateInput(sanitizedValue);
    setLocalError(validation.error);
    onChange(sanitizedValue, validation.isValid);
  }, [onChange, sanitizeInput, validateInput]);

  // Handle input focus
  const handleFocus = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    onFocus?.(event);
  }, [onFocus]);

  // Handle input blur
  const handleBlur = useCallback((event: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const validation = validateInput(localValue);
    setLocalError(validation.error);
    onBlur?.(event);
  }, [localValue, onBlur, validateInput]);

  // Update local value when prop value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Validate on mount and value changes
  useEffect(() => {
    const validation = validateInput(debouncedValue);
    setLocalError(validation.error);
    onChange(debouncedValue, validation.isValid);
  }, [debouncedValue, onChange, validateInput]);

  return (
    <TextField
      inputRef={inputRef}
      id={id}
      name={name}
      label={label}
      value={maskValue(localValue)}
      type={type === 'ein' || type === 'ssn' ? 'text' : type}
      placeholder={placeholder}
      error={!!localError}
      helperText={localError}
      disabled={disabled}
      required={required}
      fullWidth
      variant="outlined"
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      inputProps={{
        'aria-label': ariaLabel || label,
        'aria-describedby': ariaDescribedBy,
        'aria-invalid': !!localError,
        'aria-required': required,
        autoComplete: sensitive ? 'off' : 'on',
        spellCheck: false,
        maxLength: validationRules?.maxLength,
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          '&.Mui-focused': {
            boxShadow: `0 0 0 2px ${theme.palette.primary.main}`,
          },
        },
        '& input': {
          caretColor: sensitive ? 'transparent' : 'auto',
        },
      }}
    />
  );
});

Input.displayName = 'Input';

export default Input;