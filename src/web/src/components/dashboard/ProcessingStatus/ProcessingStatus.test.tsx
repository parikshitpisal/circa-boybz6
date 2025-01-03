import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProcessingStatus } from './ProcessingStatus';
import { customRender, screen } from '../../../tests/utils/test-utils';
import { APPLICATION_STATUS } from '../../../constants/application.constants';

// Test data constants
const TEST_PROCESSING_METRICS = {
  processingSpeed: 4.2,
  successRate: 95,
  queueLength: 156,
  dailyCapacity: 1000,
  isLoading: false,
  error: null
};

const TEST_ERROR_STATE = {
  processingSpeed: 0,
  successRate: 0,
  queueLength: 0,
  dailyCapacity: 0,
  isLoading: false,
  error: 'Failed to fetch metrics'
};

// Mock applications data
const mockApplications = [
  {
    id: '1',
    status: APPLICATION_STATUS.COMPLETED,
    metadata: {
      processingDuration: 4.2
    },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    status: APPLICATION_STATUS.PROCESSING,
    metadata: {
      processingDuration: 3.8
    },
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

describe('ProcessingStatus Component', () => {
  // Setup and cleanup
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders loading state correctly', () => {
    customRender(<ProcessingStatus applications={[]} loading={true} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Loading processing metrics...')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays all processing metrics accurately', async () => {
    customRender(<ProcessingStatus applications={mockApplications} />);

    // Verify processing speed section
    const speedSection = screen.getByRole('region', { name: /Processing Speed/i });
    expect(within(speedSection).getByRole('progressbar')).toBeInTheDocument();
    expect(speedSection).toHaveTextContent('4.2s');

    // Verify success rate section
    const successSection = screen.getByRole('region', { name: /Success Rate/i });
    expect(within(successSection).getByRole('progressbar')).toBeInTheDocument();
    expect(successSection).toHaveTextContent('95.0%');

    // Verify queue statistics
    expect(screen.getByText('Processed Today')).toBeInTheDocument();
    expect(screen.getByText('156')).toBeInTheDocument();
    expect(screen.getByText('In Queue')).toBeInTheDocument();
  });

  it('handles error states appropriately', () => {
    customRender(<ProcessingStatus applications={[]} error="Failed to load metrics" />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unable to calculate processing metrics')).toBeInTheDocument();
  });

  it('updates metrics in real-time when applications change', async () => {
    const { rerender } = customRender(<ProcessingStatus applications={mockApplications} />);

    // Initial state
    expect(screen.getByText('4.2s')).toBeInTheDocument();

    // Add new application and verify update
    const updatedApplications = [
      ...mockApplications,
      {
        id: '3',
        status: APPLICATION_STATUS.COMPLETED,
        metadata: {
          processingDuration: 3.5
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    rerender(<ProcessingStatus applications={updatedApplications} />);

    await waitFor(() => {
      expect(screen.getByText('3.8s')).toBeInTheDocument();
    });
  });

  it('displays tooltips with detailed information', async () => {
    customRender(<ProcessingStatus applications={mockApplications} />);
    
    // Hover over processing speed
    const speedValue = screen.getByText('4.2s');
    fireEvent.mouseOver(speedValue);
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Average processing time per application');
    });

    // Hover over success rate
    const successRate = screen.getByText('95.0%');
    fireEvent.mouseOver(successRate);
    
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent('Percentage of successfully processed applications');
    });
  });

  it('maintains accessibility standards', () => {
    const { container } = customRender(<ProcessingStatus applications={mockApplications} />);

    // Verify ARIA labels
    expect(screen.getByRole('region', { name: 'Application Processing Metrics' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Processing speed indicator' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Success rate indicator' })).toBeInTheDocument();

    // Verify color contrast
    const progressBars = screen.getAllByRole('progressbar');
    progressBars.forEach(bar => {
      expect(bar).toHaveStyle({ backgroundColor: expect.stringMatching(/^#/) });
    });
  });

  it('handles empty application list gracefully', () => {
    customRender(<ProcessingStatus applications={[]} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });

  it('calculates metrics within specified time window', () => {
    const oldApplication = {
      id: '4',
      status: APPLICATION_STATUS.COMPLETED,
      metadata: {
        processingDuration: 10.0
      },
      createdAt: new Date(Date.now() - (25 * 3600000)).toISOString(), // 25 hours ago
      updatedAt: new Date(Date.now() - (25 * 3600000)).toISOString()
    };

    customRender(<ProcessingStatus applications={[...mockApplications, oldApplication]} />);

    // Should not include the old application in calculations
    expect(screen.getByText('4.2s')).toBeInTheDocument();
  });
});