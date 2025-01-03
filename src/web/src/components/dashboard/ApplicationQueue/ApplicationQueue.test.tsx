import React from 'react';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { axe } from '@axe-core/react';
import { WebSocket, Server } from 'mock-socket';
import { customRender } from '../../../tests/utils/test-utils';
import { ApplicationQueue } from './ApplicationQueue';
import { APPLICATION_STATUS } from '../../../constants/application.constants';
import type { IApplication } from '../../../interfaces/application.interface';

// Mock WebSocket URL
const WS_URL = 'ws://localhost:3000/ws';

// Test IDs for component elements
const TEST_IDS = {
  applicationQueue: 'application-queue',
  loadingIndicator: 'loading-indicator',
  errorMessage: 'error-message',
  table: 'data-table-component',
  statusFilter: 'status-filter',
  pagination: 'pagination-controls'
};

// Mock data generators
const createMockApplication = (index: number): IApplication => ({
  id: `app-${index}`,
  status: Object.values(APPLICATION_STATUS)[index % 5],
  emailSource: `test${index}@example.com`,
  merchantData: {
    businessName: `Business ${index}`,
    ein: `12-345${index}`,
    dba: `DBA ${index}`,
    address: {
      street: '123 Test St',
      city: 'Test City',
      state: 'TS',
      zipCode: '12345',
      country: 'USA'
    },
    ownerInfo: {
      firstName: 'John',
      lastName: 'Doe',
      ssn: '123-45-6789',
      dateOfBirth: new Date('1980-01-01'),
      phoneNumber: '123-456-7890',
      email: 'john@example.com',
      ownership: 100
    },
    financialInfo: {
      bankName: 'Test Bank',
      accountNumber: '123456789',
      routingNumber: '987654321',
      monthlyRevenue: 50000,
      annualRevenue: 600000,
      outstandingLoans: 0,
      creditCardVolume: 40000
    },
    businessMetrics: {
      averageMonthlyRevenue: 50000,
      monthsInBusiness: 24,
      creditScore: 700,
      industryCategories: ['Retail']
    }
  },
  documents: [],
  metadata: {
    processingDuration: 1500,
    extractedData: {},
    validationErrors: [],
    processingNotes: [],
    validationFlags: {}
  },
  processingMetrics: {
    processingDuration: 1500,
    ocrConfidenceAverage: 0.95,
    validationAttempts: 1,
    processingSteps: ['OCR', 'VALIDATION'],
    stepDurations: {
      OCR: 1000,
      VALIDATION: 500
    }
  },
  createdAt: new Date(Date.now() - index * 3600000),
  updatedAt: new Date()
});

// Generate large dataset for performance testing
const mockApplications = Array.from({ length: 1000 }, (_, i) => createMockApplication(i));

describe('ApplicationQueue', () => {
  let mockWebSocketServer: Server;

  beforeEach(() => {
    // Setup WebSocket mock server
    mockWebSocketServer = new Server(WS_URL);
    vi.spyOn(window, 'WebSocket').mockImplementation((url) => new WebSocket(url));
  });

  afterEach(() => {
    mockWebSocketServer.close();
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render loading state correctly', () => {
      const { container } = customRender(
        <ApplicationQueue 
          pageSize={25}
          realtimeUpdates={true}
        />
      );
      
      expect(screen.getByTestId(TEST_IDS.loadingIndicator)).toBeInTheDocument();
      expect(container).toMatchSnapshot();
    });

    it('should render empty state correctly', async () => {
      const { container } = customRender(
        <ApplicationQueue 
          pageSize={25}
          realtimeUpdates={true}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('No data available')).toBeInTheDocument();
      });
      expect(container).toMatchSnapshot();
    });

    it('should render applications data correctly', async () => {
      const { container } = customRender(
        <ApplicationQueue 
          pageSize={25}
          realtimeUpdates={true}
        />
      );

      await waitFor(() => {
        mockApplications.slice(0, 25).forEach(app => {
          expect(screen.getByText(app.merchantData.businessName)).toBeInTheDocument();
        });
      });
      expect(container).toMatchSnapshot();
    });

    it('should pass accessibility audit', async () => {
      const { container } = customRender(
        <ApplicationQueue 
          pageSize={25}
          realtimeUpdates={true}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Interactions', () => {
    it('should handle sorting by business name', async () => {
      const onSort = vi.fn();
      customRender(
        <ApplicationQueue 
          pageSize={25}
          realtimeUpdates={true}
          onSort={onSort}
        />
      );

      const headerCell = screen.getByText('Business Name');
      await userEvent.click(headerCell);

      expect(onSort).toHaveBeenCalledWith('businessName', 'asc');
    });

    it('should handle status filtering', async () => {
      const onFilter = vi.fn();
      customRender(
        <ApplicationQueue 
          pageSize={25}
          realtimeUpdates={true}
          onFilter={onFilter}
        />
      );

      const statusFilter = screen.getByTestId(TEST_IDS.statusFilter);
      await userEvent.selectOptions(statusFilter, APPLICATION_STATUS.PENDING);

      expect(onFilter).toHaveBeenCalledWith({ status: APPLICATION_STATUS.PENDING });
    });

    it('should handle pagination', async () => {
      const onPageChange = vi.fn();
      customRender(
        <ApplicationQueue 
          pageSize={25}
          realtimeUpdates={true}
          onPageChange={onPageChange}
        />
      );

      const nextPageButton = screen.getByLabelText('Go to next page');
      await userEvent.click(nextPageButton);

      expect(onPageChange).toHaveBeenCalledWith(1);
    });

    it('should support keyboard navigation', async () => {
      customRender(
        <ApplicationQueue 
          pageSize={25}
          realtimeUpdates={true}
        />
      );

      const table = screen.getByTestId(TEST_IDS.table);
      await userEvent.tab();
      expect(table).toHaveFocus();

      await userEvent.keyboard('{ArrowDown}');
      const firstRow = within(table).getAllByRole('row')[1];
      expect(firstRow).toHaveFocus();
    });
  });

  describe('RealTimeUpdates', () => {
    it('should handle WebSocket connection', async () => {
      customRender(
        <ApplicationQueue 
          pageSize={25}
          realtimeUpdates={true}
        />
      );

      await waitFor(() => {
        expect(window.WebSocket).toHaveBeenCalledWith(WS_URL);
      });
    });

    it('should update on WebSocket message', async () => {
      customRender(
        <ApplicationQueue 
          pageSize={25}
          realtimeUpdates={true}
        />
      );

      const updatedApplication = createMockApplication(0);
      updatedApplication.status = APPLICATION_STATUS.COMPLETED;

      mockWebSocketServer.send(JSON.stringify({
        type: 'APPLICATION_UPDATE',
        data: updatedApplication
      }));

      await waitFor(() => {
        expect(screen.getByText(APPLICATION_STATUS.COMPLETED)).toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      const startTime = performance.now();
      
      customRender(
        <ApplicationQueue 
          pageSize={100}
          realtimeUpdates={true}
        />
      );

      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(1000); // Should render within 1 second

      await waitFor(() => {
        expect(screen.getAllByRole('row').length).toBe(101); // 100 items + header
      });
    });

    it('should maintain performance during scrolling', async () => {
      customRender(
        <ApplicationQueue 
          pageSize={100}
          realtimeUpdates={true}
        />
      );

      const table = screen.getByTestId(TEST_IDS.table);
      const startTime = performance.now();

      fireEvent.scroll(table, { target: { scrollTop: 1000 } });

      const scrollTime = performance.now() - startTime;
      expect(scrollTime).toBeLessThan(100); // Scroll should be smooth
    });
  });
});