import React, { memo, useCallback, useMemo } from 'react';
import { DataGrid, GridColDef, GridSortModel, GridSelectionModel } from '@mui/x-data-grid'; // @mui/x-data-grid v5.0.0
import { Box, Paper, useTheme, useMediaQuery } from '@mui/material'; // @mui/material v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // react-error-boundary v4.0.0
import { Loading } from '../Loading/Loading';

// Constants
const DEFAULT_PAGE_SIZE = 10;
const TEST_ID = 'data-table-component';
const STATUS_COLORS = {
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  default: '#757575'
} as const;
const VIRTUAL_SCROLL_THRESHOLD = 100;

// Props interface
interface TableProps {
  columns: GridColDef[];
  data: any[];
  loading?: boolean;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onSortChange?: (field: string, direction: 'asc' | 'desc') => void;
  onSelectionChange?: (selectedRows: any[]) => void;
  ariaLabel?: string;
  statusColumn?: string;
}

// Custom hook for keyboard navigation
const useTableKeyboardNavigation = () => {
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const { key, target } = event;
    
    switch (key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'ArrowLeft':
      case 'ArrowRight':
        // Handle arrow key navigation
        event.preventDefault();
        const targetElement = target as HTMLElement;
        const currentRow = targetElement.closest('[role="row"]');
        if (currentRow) {
          const nextRow = key.includes('Down') 
            ? currentRow.nextElementSibling 
            : currentRow.previousElementSibling;
          (nextRow?.querySelector('[tabindex="0"]') as HTMLElement)?.focus();
        }
        break;
      case 'Enter':
      case ' ':
        // Handle selection
        event.preventDefault();
        (target as HTMLElement).click();
        break;
    }
  }, []);

  return { handleKeyDown };
};

/**
 * A reusable table component with enhanced accessibility and responsive design
 */
export const Table = memo(({
  columns,
  data,
  loading = false,
  pageSize = DEFAULT_PAGE_SIZE,
  onPageChange,
  onSortChange,
  onSelectionChange,
  ariaLabel = 'Data table',
  statusColumn
}: TableProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { handleKeyDown } = useTableKeyboardNavigation();

  // Configure columns with status color coding if statusColumn is provided
  const enhancedColumns = useMemo(() => {
    if (!statusColumn) return columns;

    return columns.map(column => {
      if (column.field === statusColumn) {
        return {
          ...column,
          renderCell: (params) => {
            const status = params.value?.toLowerCase();
            const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.default;
            return (
              <Box
                sx={{
                  color,
                  fontWeight: 'bold',
                  textTransform: 'capitalize'
                }}
                aria-label={`Status: ${params.value}`}
              >
                {params.value}
              </Box>
            );
          }
        };
      }
      return column;
    });
  }, [columns, statusColumn]);

  // Handle sort changes
  const handleSortModelChange = useCallback((model: GridSortModel) => {
    if (onSortChange && model.length > 0) {
      const { field, sort } = model[0];
      onSortChange(field, sort as 'asc' | 'desc');
    }
  }, [onSortChange]);

  // Handle selection changes
  const handleSelectionModelChange = useCallback((selectionModel: GridSelectionModel) => {
    if (onSelectionChange) {
      const selectedRows = data.filter(row => selectionModel.includes(row.id));
      onSelectionChange(selectedRows);
    }
  }, [onSelectionChange, data]);

  // Configure virtual scrolling for large datasets
  const rowsPerPageOptions = useMemo(() => {
    return data.length > VIRTUAL_SCROLL_THRESHOLD 
      ? [10, 25, 50, 100]
      : [pageSize];
  }, [data.length, pageSize]);

  return (
    <ErrorBoundary
      fallback={
        <Box role="alert" aria-label="Table error" padding={2}>
          An error occurred while loading the table. Please try again.
        </Box>
      }
    >
      <Paper
        elevation={1}
        sx={{
          height: 400,
          width: '100%',
          position: 'relative',
          '& .MuiDataGrid-root': {
            border: 'none',
            '& .MuiDataGrid-cell:focus': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: '-1px'
            }
          }
        }}
      >
        {loading && (
          <Loading
            size="large"
            overlay
            text="Loading table data..."
          />
        )}
        
        <DataGrid
          rows={data}
          columns={enhancedColumns}
          pageSize={pageSize}
          rowsPerPageOptions={rowsPerPageOptions}
          checkboxSelection
          disableSelectionOnClick
          loading={loading}
          onPageChange={onPageChange}
          onSortModelChange={handleSortModelChange}
          onSelectionModelChange={handleSelectionModelChange}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          data-testid={TEST_ID}
          density={isMobile ? 'compact' : 'standard'}
          sx={{
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: theme.palette.background.default,
              borderBottom: `1px solid ${theme.palette.divider}`
            },
            '& .MuiDataGrid-cell': {
              borderBottom: `1px solid ${theme.palette.divider}`
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: theme.palette.action.hover
            },
            '& .MuiDataGrid-row.Mui-selected': {
              backgroundColor: theme.palette.action.selected,
              '&:hover': {
                backgroundColor: theme.palette.action.selected
              }
            }
          }}
          components={{
            NoRowsOverlay: () => (
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                height="100%"
                aria-label="No data available"
              >
                No data available
              </Box>
            )
          }}
        />
      </Paper>
    </ErrorBoundary>
  );
});

Table.displayName = 'Table';

export default Table;