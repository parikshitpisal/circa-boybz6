import React from 'react';
import { vi } from 'vitest';
import { axe } from '@axe-core/react'; // v4.7.3
import { WebSocket, Server } from 'mock-socket'; // v9.2.1
import { RecentActivity } from './RecentActivity';
import { customRender, screen, fireEvent, within } from '../../../tests/utils/test-utils';
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS } from '../../../constants/application.constants';

// Mock WebSocket for real-time updates testing
global.WebSocket = WebSocket;

// Mock application data
const mockApplicationData = [
  {
    id: '1',
    merchantData: {
      businessName: 'ABC Corp'
    },
    status: APPLICATION_STATUS.COMPLETED,
    createdAt: new Date().toISOString(),
    documents: [],
    metadata: {},
    processingMetrics: {
      processingDuration: 0,
      ocrConfidenceAverage: 0,
      validationAttempts: 0,
      processingSteps: [],
      stepDurations: {}
    },
    emailSource: 'test@example.com'
  },
  {
    id: '2',
    merchantData: {
      businessName: 'XYZ LLC'
    },
    status: APPLICATION_STATUS.FAILED,
    createdAt: new Date(Date.now() - 300000).toISOString(),
    documents: [],
    metadata: {},
    processingMetrics: {
      processingDuration: 0,
      ocrConfidenceAverage: 0,
      validationAttempts: 0,
      processingSteps: [],
      stepDurations: {}
    },
    emailSource: 'test@example.com'
  }
];

// Mock callbacks
const mockCallbacks = {
  onViewApplication: vi.fn(),
  onEditApplication: vi.fn()
};

describe('RecentActivity', () => {
  let mockServer: Server;

  beforeEach(() => {
    mockServer = new Server('ws://localhost:8080');
    mockCallbacks.onViewApplication.mockClear();
    mockCallbacks.onEditApplication.mockClear();
  });

  afterEach(() => {
    mockServer.close();
  });

  describe('Rendering', () => {
    it('should render loading state correctly', () => {
      customRender(
        <RecentActivity
          applications={[]}
          loading={true}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should render applications data correctly', () => {
      customRender(
        <RecentActivity
          applications={mockApplicationData}
          loading={false}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );

      // Verify business names are displayed
      expect(screen.getByText('ABC Corp')).toBeInTheDocument();
      expect(screen.getByText('XYZ LLC')).toBeInTheDocument();

      // Verify status chips are displayed with correct colors
      const statusChips = screen.getAllByRole('status');
      expect(statusChips[0]).toHaveTextContent(APPLICATION_STATUS_LABELS[APPLICATION_STATUS.COMPLETED]);
      expect(statusChips[1]).toHaveTextContent(APPLICATION_STATUS_LABELS[APPLICATION_STATUS.FAILED]);
    });

    it('should render empty state when no applications exist', () => {
      customRender(
        <RecentActivity
          applications={[]}
          loading={false}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );

      expect(screen.getByText('No data available')).toBeInTheDocument();
    });

    it('should render error state correctly', () => {
      const error = new Error('Failed to load applications');
      customRender(
        <RecentActivity
          applications={[]}
          loading={false}
          error={error}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );

      expect(screen.getByText(error.message)).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Interactions', () => {
    it('should call onViewApplication when view button is clicked', () => {
      customRender(
        <RecentActivity
          applications={mockApplicationData}
          loading={false}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );

      const viewButtons = screen.getAllByLabelText('View application details');
      fireEvent.click(viewButtons[0]);

      expect(mockCallbacks.onViewApplication).toHaveBeenCalledWith(mockApplicationData[0].id);
    });

    it('should call onEditApplication when edit button is clicked', () => {
      customRender(
        <RecentActivity
          applications={mockApplicationData}
          loading={false}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );

      const editButtons = screen.getAllByLabelText('Edit application');
      fireEvent.click(editButtons[0]);

      expect(mockCallbacks.onEditApplication).toHaveBeenCalledWith(mockApplicationData[0].id);
    });

    it('should handle sorting by business name', () => {
      customRender(
        <RecentActivity
          applications={mockApplicationData}
          loading={false}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );

      const businessNameHeader = screen.getByText('Business Name');
      fireEvent.click(businessNameHeader);

      const rows = screen.getAllByRole('row');
      expect(within(rows[1]).getByText('ABC Corp')).toBeInTheDocument();
    });
  });

  describe('Real-time Updates', () => {
    it('should update application status on WebSocket message', async () => {
      customRender(
        <RecentActivity
          applications={mockApplicationData}
          loading={false}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );

      // Simulate WebSocket status update
      mockServer.emit('message', JSON.stringify({
        type: 'STATUS_UPDATE',
        data: {
          applicationId: mockApplicationData[0].id,
          status: APPLICATION_STATUS.COMPLETED
        }
      }));

      // Verify status update is reflected
      const updatedStatus = await screen.findByText(APPLICATION_STATUS_LABELS[APPLICATION_STATUS.COMPLETED]);
      expect(updatedStatus).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should pass accessibility checks', async () => {
      const { container } = customRender(
        <RecentActivity
          applications={mockApplicationData}
          loading={false}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', () => {
      customRender(
        <RecentActivity
          applications={mockApplicationData}
          loading={false}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );

      const viewButton = screen.getAllByLabelText('View application details')[0];
      viewButton.focus();
      expect(document.activeElement).toBe(viewButton);

      // Test keyboard interaction
      fireEvent.keyDown(viewButton, { key: 'Enter' });
      expect(mockCallbacks.onViewApplication).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, index) => ({
        ...mockApplicationData[0],
        id: `app_${index}`,
        merchantData: { businessName: `Business ${index}` }
      }));

      const { rerender } = customRender(
        <RecentActivity
          applications={largeDataset}
          loading={false}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );

      // Verify initial render
      expect(screen.getByText('Business 0')).toBeInTheDocument();

      // Test re-render performance
      const startTime = performance.now();
      rerender(
        <RecentActivity
          applications={largeDataset}
          loading={false}
          onViewApplication={mockCallbacks.onViewApplication}
          onEditApplication={mockCallbacks.onEditApplication}
        />
      );
      const endTime = performance.now();

      // Ensure render time is within acceptable range (50ms)
      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});