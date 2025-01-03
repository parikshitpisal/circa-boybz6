/**
 * Dropdown Component
 * A highly accessible, theme-aware dropdown component with comprehensive features
 * Implements WCAG 2.1 Level AA compliance and Material-UI v5 integration
 * @version 1.0.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import classnames from 'classnames'; // v2.3.2
import { Select, MenuItem, useTheme } from '@mui/material'; // v5.0.0
import { useDebounce } from 'use-debounce'; // v9.0.0
import { validateInput } from '../../utils/validation.utils';

// Option interface for dropdown items
export interface IDropdownOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  metadata?: Record<string, unknown>;
}

// Props interface for Dropdown component
export interface IDropdownProps {
  name: string;
  id: string;
  value: string | string[] | number | number[];
  options: IDropdownOption[];
  label: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  virtualScroll?: boolean;
  maxHeight?: number;
  onChange: (value: string | string[] | number | number[]) => void;
  onBlur?: () => void;
  onSearch?: (query: string) => void;
}

/**
 * Dropdown component with comprehensive accessibility and validation features
 */
const Dropdown: React.FC<IDropdownProps> = ({
  name,
  id,
  value,
  options,
  label,
  placeholder = 'Select an option',
  error,
  disabled = false,
  required = false,
  multiple = false,
  searchable = false,
  virtualScroll = false,
  maxHeight = 300,
  onChange,
  onBlur,
  onSearch
}) => {
  const theme = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [filteredOptions, setFilteredOptions] = useState(options);

  // Memoized styles for theme consistency
  const styles = useMemo(() => ({
    select: {
      width: '100%',
      '& .MuiOutlinedInput-root': {
        borderRadius: theme.shape.borderRadius,
        backgroundColor: theme.palette.background.paper,
      },
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: error ? theme.palette.error.main : theme.palette.divider,
      }
    },
    menuItem: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    },
    icon: {
      marginRight: theme.spacing(1),
      color: theme.palette.text.secondary,
    }
  }), [theme, error]);

  // Handle option filtering for search functionality
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    const filtered = options.filter(option => 
      option.label.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredOptions(filtered);
    onSearch?.(query);
  }, [options, onSearch]);

  // Handle value changes with validation
  const handleChange = useCallback((
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    const selectedValue = event.target.value;
    
    // Validate selected value(s)
    const validationResult = validateInput(selectedValue, {
      required,
      multiple,
      options: options.map(opt => opt.value)
    });

    if (validationResult.success) {
      onChange(selectedValue as string | string[] | number | number[]);
      
      // Announce selection for screen readers
      const selectedLabels = multiple 
        ? (selectedValue as Array<string | number>)
            .map(val => options.find(opt => opt.value === val)?.label)
            .join(', ')
        : options.find(opt => opt.value === selectedValue)?.label;
      
      const announcement = multiple
        ? `Selected items: ${selectedLabels}`
        : `Selected: ${selectedLabels}`;
        
      document.getElementById('dropdown-live-region')?.setAttribute('aria-label', announcement);
    }
  }, [options, required, multiple, onChange]);

  // Virtual scroll configuration for large option lists
  const virtualScrollProps = useMemo(() => virtualScroll ? {
    MenuProps: {
      PaperProps: {
        style: {
          maxHeight,
        },
      },
      // Virtual scroll configuration
      virtualScrolling: true,
      rowHeight: 48,
      overscanCount: 5,
    }
  } : {}, [virtualScroll, maxHeight]);

  return (
    <div className="dropdown-container">
      {/* Hidden live region for screen reader announcements */}
      <div
        id="dropdown-live-region"
        role="status"
        aria-live="polite"
        className="visually-hidden"
      />
      
      <Select
        name={name}
        id={id}
        value={value}
        multiple={multiple}
        disabled={disabled}
        error={!!error}
        required={required}
        displayEmpty
        sx={styles.select}
        onChange={handleChange}
        onBlur={onBlur}
        {...virtualScrollProps}
        aria-label={label}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={!!error}
        aria-required={required}
        MenuProps={{
          ...virtualScrollProps.MenuProps,
          className: classnames('dropdown-menu', {
            'dropdown-menu--searchable': searchable
          })
        }}
      >
        {/* Placeholder option */}
        {!multiple && (
          <MenuItem value="" disabled>
            {placeholder}
          </MenuItem>
        )}

        {/* Search input for filterable dropdowns */}
        {searchable && (
          <MenuItem className="dropdown-search" disabled>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search options..."
              aria-label="Search dropdown options"
              onClick={(e) => e.stopPropagation()}
            />
          </MenuItem>
        )}

        {/* Dropdown options */}
        {(searchable ? filteredOptions : options).map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            sx={styles.menuItem}
            aria-selected={multiple 
              ? (value as Array<string | number>).includes(option.value)
              : value === option.value
            }
          >
            {option.icon && (
              <span className="option-icon" aria-hidden="true" style={styles.icon}>
                {option.icon}
              </span>
            )}
            {option.label}
          </MenuItem>
        ))}
      </Select>

      {/* Error message */}
      {error && (
        <div
          id={`${id}-error`}
          className="dropdown-error"
          role="alert"
          style={{ color: theme.palette.error.main }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default React.memo(Dropdown);