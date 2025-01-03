import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Card, Typography, Skeleton } from '@mui/material'; // @mui/material v5.0.0
import { useDispatch, useSelector } from 'react-redux'; // react-redux v8.1.0
import useWebSocket from 'react-use-websocket'; // react-use-websocket v4.0.0

import { Table } from '../../common/Table/Table';
import { IApplication } from '../../../interfaces/application.interface';
import { fetchApplications } from '../../../store/actions/application.actions';
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS, STATUS_COLORS } from '../../../constants/application.constants';

// WebSocket endpoint for real-time updates
const WS_ENDPOINT = process.env.VITE_WS_ENDPOINT || 'ws://localhost:3000/ws';

interface ApplicationQueueProps {
  pageSize?: number;
  status?: APPLICATION_STATUS;
  filters?: IApplicationFilter[];
  realtimeUpdates?: boolean;
}

interface IApplicationFilter {
  field: string;
  value: any;
}

// Enhanced queue columns with accessibility and sorting
const QUEUE_COLUMNS = [
  {
    field: 'businessName',
    headerName: 'Business Name',
    width: 200,
    sortable: true,
    renderCell: (params: any) => (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
        aria-label={`Business: ${params.row.merchantData.businessName}`}
      >
        <Typography variant="body2">
          {params.row.merchantData.businessName}
        </Typography>
      </Box>
    )
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    renderCell: (params: any) => (
      <Box
        sx={{
          color: STATUS_COLORS[params.row.status],
          fontWeight: 'medium',
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: `${STATUS_COLORS[params.row.status]}15`
        }}
        aria-label={`Status: ${APPLICATION_STATUS_LABELS[params.row.status]}`}
      >
        {APPLICATION_STATUS_LABELS[params.row.status]}
      </Box>
    )
  },
  {
    field: 'createdAt',
    headerName: 'Submitted',
    width: 160,
    sortable: true,
    valueFormatter: (params: any) => new Date(params.value).toLocaleString()
  },
  {
    field: 'processingTime',
    headerName: 'Processing Time',
    width: 140,
    renderCell: (params: any) => {
      const duration = params.row.processingMetadata?.processingDuration || 0;
      return (
        <Box aria-label={`Processing time: ${duration}ms`}>
          {duration ? `${(duration / 1000).toFixed(1)}s` : 'Pending'}
        </Box>
      );
    }
  }
];

// Retry configuration for failed requests
const RETRY_CONFIG = {
  maxRetries: 3,
  backoffFactor: 1.5,
  initialDelay: 1000
};

export const ApplicationQueue: React.FC<ApplicationQueueProps> = ({
  pageSize = 25,
  status,
  filters = [],
  realtimeUpdates = true
}) => {
  const dispatch = useDispatch();
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // WebSocket connection for real-time updates
  const { lastMessage } = useWebSocket(realtimeUpdates ? WS_ENDPOINT : null, {
    shouldReconnect: () => realtimeUpdates,
    reconnectInterval: 3000,
    reconnectAttempts: 10
  });

  // Memoized applications selector
  const applications = useSelector((state: any) => state.applications.items);
  const totalApplications = useSelector((state: any) => state.applications.total);

  // Enhanced fetch applications with retry logic
  const fetchApplicationsWithRetry = useCallback(async (retryCount = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      await dispatch(fetchApplications({
        page,
        limit: pageSize,
        filters: {
          status,
          ...filters.reduce((acc, filter) => ({
            ...acc,
            [filter.field]: filter.value
          }), {})
        }
      }));
    } catch (err) {
      if (retryCount < RETRY_CONFIG.maxRetries) {
        const delay = RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffFactor, retryCount);
        setTimeout(() => {
          fetchApplicationsWithRetry(retryCount + 1);
        }, delay);
      } else {
        setError('Failed to load applications. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [dispatch, page, pageSize, status, filters]);

  // Initial data fetch
  useEffect(() => {
    fetchApplicationsWithRetry();
  }, [fetchApplicationsWithRetry]);

  // Handle real-time updates
  useEffect(() => {
    if (lastMessage) {
      try {
        const update = JSON.parse(lastMessage.data);
        if (update.type === 'APPLICATION_UPDATE') {
          fetchApplicationsWithRetry();
        }
      } catch (err) {
        console.error('Failed to process WebSocket message:', err);
      }
    }
  }, [lastMessage, fetchApplicationsWithRetry]);

  // Handle page changes
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // Enhanced error handling for table
  const handleTableError = useCallback((error: Error) => {
    setError(`Table error: ${error.message}`);
    console.error('Table error:', error);
  }, []);

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Typography
          variant="h6"
          component="h2"
          sx={{ fontWeight: 'medium' }}
        >
          Application Queue
        </Typography>
        {loading && (
          <Skeleton
            width={100}
            height={24}
            animation="wave"
            sx={{ bgcolor: 'rgba(0, 0, 0, 0.1)' }}
          />
        )}
      </Box>

      {error && (
        <Box
          sx={{
            p: 2,
            color: 'error.main',
            bgcolor: 'error.light',
            borderRadius: 1
          }}
          role="alert"
        >
          {error}
        </Box>
      )}

      <Table
        columns={QUEUE_COLUMNS}
        data={applications}
        loading={loading}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onError={handleTableError}
        virtualScroll={totalApplications > 100}
        ariaLabel="Application Queue"
        statusColumn="status"
      />
    </Card>
  );
};

export default ApplicationQueue;