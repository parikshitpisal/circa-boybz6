import React from 'react';
import { describe, it, expect, jest } from '@jest/globals';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { customRender } from '../../../tests/utils/test-utils';
import { Statistics } from './Statistics';

// Mock API response data
const mockApiResponse = {
  data: [
    {
      status: 'COMPLETED',
      metadata: { processingDuration: 252 }, // 4.2 minutes
      createdAt: new Date().toISOString()
    }
  ]
};

// Mock API hook
jest.mock('../../../hooks/useApi', () => ({
  useApi: () => ({
    execute: jest.fn().mockResolvedValue(mockApiResponse.data),
    loading: false,
    error: null
  })
}));

describe('Statistics Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('renders loading state initially', async () => {
    const { container } = customRender(<Statistics />);
    
    // Verify loading indicators are present
    expect(screen.getAllByRole('progressbar')).toHaveLength(4);
    
    // Verify loading overlays
    const loadingOverlays = container.querySelectorAll('.MuiCircularProgress-root');
    expect(loadingOverlays).toHaveLength(4);
    
    // Verify accessibility during loading
    expect(screen.getByText('Processing Speed')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Daily Volume')).toBeInTheDocument();
    expect(screen.getByText('Queue Size')).toBeInTheDocument();
  });

  it('renders all statistics metrics correctly', async () => {
    customRender(<Statistics refreshInterval={30000} />);

    await waitFor(() => {
      // Verify processing speed
      expect(screen.getByText('4.2 min')).toBeInTheDocument();
      
      // Verify success rate
      expect(screen.getByText('95.5%')).toBeInTheDocument();
      
      // Verify daily volume
      expect(screen.getByText('156')).toBeInTheDocument();
      
      // Verify queue size
      expect(screen.getByText('23')).toBeInTheDocument();
    });
  });

  it('formats metric values correctly', async () => {
    const { rerender } = customRender(<Statistics />);

    // Test different processing speeds
    await waitFor(() => {
      expect(screen.getByText('4.2 min')).toHaveStyle({ fontSize: '24px' });
    });

    // Test percentage formatting
    const mockHighSuccessRate = {
      data: [{ status: 'COMPLETED', metadata: { processingDuration: 180 } }]
    };
    jest.mock('../../../hooks/useApi', () => ({
      useApi: () => ({
        execute: jest.fn().mockResolvedValue(mockHighSuccessRate.data),
        loading: false,
        error: null
      })
    }));
    rerender(<Statistics />);

    await waitFor(() => {
      expect(screen.getByText('100.0%')).toBeInTheDocument();
    });
  });

  it('handles zero and null values appropriately', async () => {
    const mockEmptyData = {
      data: []
    };
    jest.mock('../../../hooks/useApi', () => ({
      useApi: () => ({
        execute: jest.fn().mockResolvedValue(mockEmptyData.data),
        loading: false,
        error: null
      })
    }));

    customRender(<Statistics />);

    await waitFor(() => {
      expect(screen.getByText('0 min')).toBeInTheDocument();
      expect(screen.getByText('0%')).toBeInTheDocument();
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  it('updates metrics in real-time', async () => {
    const mockUpdatedData = {
      data: [
        {
          status: 'COMPLETED',
          metadata: { processingDuration: 300 }, // 5 minutes
          createdAt: new Date().toISOString()
        }
      ]
    };

    let apiCallCount = 0;
    jest.mock('../../../hooks/useApi', () => ({
      useApi: () => ({
        execute: jest.fn().mockImplementation(() => {
          apiCallCount++;
          return Promise.resolve(apiCallCount === 1 ? mockApiResponse.data : mockUpdatedData.data);
        }),
        loading: false,
        error: null
      })
    }));

    customRender(<Statistics refreshInterval={30000} />);

    // Initial render
    await waitFor(() => {
      expect(screen.getByText('4.2 min')).toBeInTheDocument();
    });

    // Advance timers to trigger refresh
    jest.advanceTimersByTime(30000);

    // Verify updated values
    await waitFor(() => {
      expect(screen.getByText('5.0 min')).toBeInTheDocument();
    });
  });

  it('maintains accessibility standards', async () => {
    const { container } = customRender(<Statistics />);

    // Verify ARIA labels
    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(container.querySelectorAll('[aria-label]')).toHaveLength(4);

    // Verify keyboard navigation
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(4);
    cards.forEach(card => {
      expect(card).toHaveAttribute('tabIndex', '0');
    });

    // Verify screen reader text
    const metrics = ['Processing Speed', 'Success Rate', 'Daily Volume', 'Queue Size'];
    metrics.forEach(metric => {
      expect(screen.getByText(metric)).toHaveAttribute('aria-label');
    });
  });

  it('handles API errors gracefully', async () => {
    jest.mock('../../../hooks/useApi', () => ({
      useApi: () => ({
        execute: jest.fn().mockRejectedValue(new Error('API Error')),
        loading: false,
        error: 'Failed to load statistics'
      })
    }));

    customRender(<Statistics />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load statistics:')).toBeInTheDocument();
    });
  });
});