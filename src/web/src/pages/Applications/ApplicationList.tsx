import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Box, Typography, Chip, CircularProgress, Alert } from '@mui/material'; // @mui/material v5.0.0
import { Table } from '../../components/common/Table/Table';
import { IApplication } from '../../interfaces/application.interface';
import { useApi } from '../../hooks/useApi';
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS, STATUS_COLORS } from '../../constants/application.constants';
import { apiConfig } from '../../config/api.config';

// Constants for component configuration
const REFRESH_INTERVAL = 30000; // 30 seconds
const DEFAULT_PAGE_SIZE = 25;
const WEBSOCKET_RETRY_DELAY = 5000;

interface ApplicationListProps {
  enableRealTimeUpdates?: boolean;
  updateInterval?: number;
  onStatusChange?: (applicationId: string, newStatus: APPLICATION_STATUS) => void;
}

interface ApplicationFilters {
  status: APPLICATION_STATUS[];
  searchTerm: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  merchantTypes: string[];
  amountMin: number | null;
  amountMax: number | null;
}

/**
 * Enhanced ApplicationList component for high-volume application processing
 * with real-time updates and accessibility features
 */
export const ApplicationList: React.FC<ApplicationListProps> = ({
  enableRealTimeUpdates = true,
  updateInterval = REFRESH_INTERVAL,
  onStatusChange
}) => {
  // State management
  const [filters, setFilters] = useState<ApplicationFilters>({
    status: [],
    searchTerm: '',
    dateFrom: null,
    dateTo: null,
    merchantTypes: [],
    amountMin: null,
    amountMax: null
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortField, setSortField] = useState<string>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // WebSocket connection for real-time updates
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // API hook for fetching applications
  const {
    data: applications,
    loading,
    error,
    execute: fetchApplications,
    pagination
  } = useApi<IApplication[]>({
    method: 'GET',
    url: `${apiConfig.endpoints.applications}`,
    retryConfig: {
      maxRetries: 3,
      backoffFactor: 2,
      retryCondition: (error) => error.status !== 403
    }
  });

  // Table columns configuration with accessibility features
  const columns = [
    {
      field: 'id',
      headerName: 'Application ID',
      width: 180,
      renderCell: (params: any) => (
        <Typography variant="body2" component="span" aria-label={`Application ID: ${params.value}`}>
          {params.value}
        </Typography>
      )
    },
    {
      field: 'merchantData.businessName',
      headerName: 'Business Name',
      width: 250,
      valueGetter: (params: any) => params.row.merchantData?.businessName
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      renderCell: (params: any) => (
        <Chip
          label={APPLICATION_STATUS_LABELS[params.value]}
          sx={{
            backgroundColor: STATUS_COLORS[params.value],
            color: '#ffffff'
          }}
          aria-label={`Status: ${APPLICATION_STATUS_LABELS[params.value]}`}
        />
      )
    },
    {
      field: 'createdAt',
      headerName: 'Submission Date',
      width: 180,
      valueFormatter: (params: any) => new Date(params.value).toLocaleString()
    },
    {
      field: 'merchantData.financialInfo.monthlyRevenue',
      headerName: 'Monthly Revenue',
      width: 150,
      valueFormatter: (params: any) => 
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
          .format(params.row.merchantData?.financialInfo?.monthlyRevenue || 0)
    }
  ];

  // WebSocket connection management
  const setupWebSocket = useCallback(() => {
    if (!enableRealTimeUpdates) return;

    const ws = new WebSocket(process.env.VITE_WS_URL || 'ws://localhost:3000/ws');
    
    ws.onopen = () => {
      console.debug('WebSocket connected');
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === 'APPLICATION_UPDATE') {
        onStatusChange?.(update.applicationId, update.newStatus);
        fetchApplications();
      }
    };

    ws.onclose = () => {
      console.debug('WebSocket disconnected');
      reconnectTimeoutRef.current = setTimeout(() => {
        setupWebSocket();
      }, WEBSOCKET_RETRY_DELAY);
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enableRealTimeUpdates, onStatusChange, fetchApplications]);

  // Initial data fetch and polling setup
  useEffect(() => {
    fetchApplications();
    
    if (enableRealTimeUpdates) {
      const pollInterval = setInterval(fetchApplications, updateInterval);
      setupWebSocket();

      return () => {
        clearInterval(pollInterval);
        wsRef.current?.close();
      };
    }
  }, [enableRealTimeUpdates, updateInterval, fetchApplications, setupWebSocket]);

  // Handle pagination changes
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  // Handle sorting changes
  const handleSortChange = useCallback((field: string, direction: 'asc' | 'desc') => {
    setSortField(field);
    setSortDirection(direction);
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<ApplicationFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(1); // Reset to first page when filters change
  }, []);

  // Error display component
  const renderError = () => {
    if (!error) return null;

    return (
      <Alert 
        severity="error" 
        sx={{ mb: 2 }}
        aria-live="polite"
      >
        {error.message}
      </Alert>
    );
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        p: 2
      }}
      role="region"
      aria-label="Applications List"
    >
      {renderError()}

      <Table
        columns={columns}
        data={applications || []}
        loading={loading}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onSortChange={handleSortChange}
        statusColumn="status"
        ariaLabel="Applications table"
      />

      {loading && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            p: 2
          }}
          role="status"
          aria-label="Loading applications"
        >
          <CircularProgress size={24} />
          <Typography sx={{ ml: 1 }}>
            Loading applications...
          </Typography>
        </Box>
      )}

      {pagination && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1 }}
          aria-live="polite"
        >
          Showing {pagination.page * pagination.limit - pagination.limit + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} applications
        </Typography>
      )}
    </Box>
  );
};

export default ApplicationList;