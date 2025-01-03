import React from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { axe } from '@axe-core/react';
import { Table } from './Table';
import { customRender } from '../../../tests/utils/test-utils';

// Mock data for testing
const mockData = [
  { id: '1', name: 'Test Item 1', status: 'Active', date: '2023-01-01', amount: 1000 },
  { id: '2', name: 'Test Item 2', status: 'Inactive', date: '2023-01-02', amount: 2000 }
];

const mockColumns = [
  { field: 'id', headerName: 'ID', width: 100, sortable: true },
  { field: 'name', headerName: 'Name', width: 200, sortable: true },
  { field: 'status', headerName: 'Status', width: 150, sortable: true },
  { field: 'date', headerName: 'Date', width: 150, sortable: true },
  { field: 'amount', headerName: 'Amount', width: 150, sortable: true }
];

describe('Table Component', () => {
  // Mock callback functions
  const onPageChange = jest.fn();
  const onSortChange = jest.fn();
  const onSelectionChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders table with data correctly', () => {
    customRender(
      <Table
        data={mockData}
        columns={mockColumns}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onSelectionChange={onSelectionChange}
        ariaLabel="Test table"
      />
    );

    // Verify table headers
    mockColumns.forEach(column => {
      expect(screen.getByText(column.headerName)).toBeInTheDocument();
    });

    // Verify data rows
    mockData.forEach(item => {
      expect(screen.getByText(item.name)).toBeInTheDocument();
      expect(screen.getByText(item.status)).toBeInTheDocument();
    });
  });

  it('handles loading state correctly', () => {
    customRender(
      <Table
        data={mockData}
        columns={mockColumns}
        loading={true}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onSelectionChange={onSelectionChange}
      />
    );

    expect(screen.getByText('Loading table data...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('handles empty data state correctly', () => {
    customRender(
      <Table
        data={[]}
        columns={mockColumns}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onSelectionChange={onSelectionChange}
      />
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('handles sorting correctly', async () => {
    customRender(
      <Table
        data={mockData}
        columns={mockColumns}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onSelectionChange={onSelectionChange}
      />
    );

    // Click on sortable column header
    const nameHeader = screen.getByText('Name');
    fireEvent.click(nameHeader);

    await waitFor(() => {
      expect(onSortChange).toHaveBeenCalledWith('name', 'asc');
    });

    // Click again for descending sort
    fireEvent.click(nameHeader);

    await waitFor(() => {
      expect(onSortChange).toHaveBeenCalledWith('name', 'desc');
    });
  });

  it('handles row selection correctly', async () => {
    customRender(
      <Table
        data={mockData}
        columns={mockColumns}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onSelectionChange={onSelectionChange}
      />
    );

    // Select first row checkbox
    const firstRowCheckbox = screen.getAllByRole('checkbox')[1];
    fireEvent.click(firstRowCheckbox);

    await waitFor(() => {
      expect(onSelectionChange).toHaveBeenCalledWith([mockData[0]]);
    });
  });

  it('handles pagination correctly', async () => {
    customRender(
      <Table
        data={mockData}
        columns={mockColumns}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onSelectionChange={onSelectionChange}
      />
    );

    // Navigate to next page
    const nextPageButton = screen.getByRole('button', { name: /next page/i });
    fireEvent.click(nextPageButton);

    await waitFor(() => {
      expect(onPageChange).toHaveBeenCalledWith(1);
    });
  });

  it('meets accessibility requirements', async () => {
    const { container } = customRender(
      <Table
        data={mockData}
        columns={mockColumns}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onSelectionChange={onSelectionChange}
        ariaLabel="Test table"
      />
    );

    // Run axe accessibility tests
    const results = await axe(container);
    expect(results).toHaveNoViolations();

    // Verify ARIA roles and labels
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByLabelText('Test table')).toBeInTheDocument();

    // Test keyboard navigation
    const table = screen.getByRole('grid');
    table.focus();
    fireEvent.keyDown(table, { key: 'ArrowDown' });
    expect(document.activeElement).toHaveAttribute('role', 'row');
  });

  it('handles status column color coding correctly', () => {
    customRender(
      <Table
        data={mockData}
        columns={mockColumns}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onSelectionChange={onSelectionChange}
        statusColumn="status"
      />
    );

    const activeStatus = screen.getByText('Active');
    const inactiveStatus = screen.getByText('Inactive');

    expect(activeStatus.closest('div')).toHaveStyle({ color: '#4caf50' });
    expect(inactiveStatus.closest('div')).toHaveStyle({ color: '#757575' });
  });

  it('handles responsive design correctly', () => {
    // Mock mobile viewport
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(max-width: 600px)',
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));

    customRender(
      <Table
        data={mockData}
        columns={mockColumns}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onSelectionChange={onSelectionChange}
      />
    );

    const table = screen.getByTestId('data-table-component');
    expect(table).toHaveAttribute('aria-label');
    expect(table).toHaveStyle({ density: 'compact' });
  });

  it('handles error state correctly', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    customRender(
      <Table
        data={null as any}
        columns={mockColumns}
        onPageChange={onPageChange}
        onSortChange={onSortChange}
        onSelectionChange={onSelectionChange}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'An error occurred while loading the table. Please try again.'
    );

    consoleError.mockRestore();
  });
});