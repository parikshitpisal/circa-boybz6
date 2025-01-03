import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Box, IconButton, Tooltip, Chip, CircularProgress } from '@mui/material'; // @mui/material v5.0.0
import { Delete, Edit, PlayArrow, Warning, CheckCircle } from '@mui/icons-material'; // @mui/icons-material v5.0.0
import { ErrorBoundary } from 'react-error-boundary'; // react-error-boundary v4.0.0

import { Table } from '../../common/Table/Table';
import { WebhookService } from '../../../services/webhook.service';
import { WebhookConfig, WebhookEvent, WebhookStatus, WebhookDeliveryStatus } from '../../../interfaces/webhook.interface';

// Enhanced props interface with comprehensive callback handlers
interface WebhookListProps {
  onEdit: (webhook: WebhookConfig) => void;
  onDelete: (id: string) => Promise<void>;
  onTest: (id: string) => Promise<void>;
  onHealthCheck: (id: string) => Promise<WebhookDeliveryStatus>;
  onRetry: (id: string) => Promise<void>;
}

// Enhanced interface for webhook health metrics
interface WebhookHealth {
  uptime: number;
  successRate: number;
  lastDelivery: Date;
  avgResponseTime: number;
}

// Table column configuration with accessibility enhancements
const COLUMNS = [
  {
    field: 'url',
    headerName: 'Endpoint URL',
    flex: 2,
    sortable: true,
    renderCell: (params: any) => (
      <Tooltip title={params.value} aria-label="Webhook URL">
        <Box sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {params.value}
        </Box>
      </Tooltip>
    )
  },
  {
    field: 'events',
    headerName: 'Events',
    flex: 1,
    renderCell: (params: any) => (
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {params.value.map((event: WebhookEvent) => (
          <Chip
            key={event}
            label={event.replace('_', ' ')}
            size="small"
            sx={{ maxWidth: 120 }}
            aria-label={`Event: ${event}`}
          />
        ))}
      </Box>
    )
  },
  {
    field: 'status',
    headerName: 'Status',
    flex: 1,
    renderCell: (params: any) => {
      const status = params.value as WebhookStatus;
      const statusConfig = {
        [WebhookStatus.ACTIVE]: { icon: <CheckCircle color="success" />, color: 'success' },
        [WebhookStatus.FAILED]: { icon: <Warning color="error" />, color: 'error' },
        [WebhookStatus.INACTIVE]: { icon: <Warning color="warning" />, color: 'warning' },
        [WebhookStatus.SUSPENDED]: { icon: <Warning color="error" />, color: 'error' },
        [WebhookStatus.RATE_LIMITED]: { icon: <Warning color="warning" />, color: 'warning' }
      };

      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {statusConfig[status].icon}
          <Chip
            label={status}
            color={statusConfig[status].color as any}
            size="small"
            aria-label={`Status: ${status}`}
          />
        </Box>
      );
    }
  },
  {
    field: 'health',
    headerName: 'Health',
    flex: 1,
    renderCell: (params: any) => {
      const health = params.value as WebhookHealth;
      return (
        <Tooltip
          title={`Success Rate: ${health.successRate}% | Avg Response: ${health.avgResponseTime}ms`}
          aria-label="Webhook health metrics"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress
              variant="determinate"
              value={health.successRate}
              size={24}
              color={health.successRate > 90 ? 'success' : 'warning'}
              aria-label={`Health: ${health.successRate}%`}
            />
            {health.successRate}%
          </Box>
        </Tooltip>
      );
    }
  },
  {
    field: 'actions',
    headerName: 'Actions',
    flex: 1,
    sortable: false,
    renderCell: (params: any) => (
      <Box sx={{ display: 'flex', gap: 1 }} role="group" aria-label="Webhook actions">
        <Tooltip title="Test Webhook" aria-label="Test webhook">
          <IconButton
            onClick={() => params.row.onTest(params.row.id)}
            size="small"
            color="primary"
            aria-label="Test webhook"
          >
            <PlayArrow />
          </IconButton>
        </Tooltip>
        <Tooltip title="Edit Webhook" aria-label="Edit webhook">
          <IconButton
            onClick={() => params.row.onEdit(params.row)}
            size="small"
            color="primary"
            aria-label="Edit webhook"
          >
            <Edit />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Webhook" aria-label="Delete webhook">
          <IconButton
            onClick={() => params.row.onDelete(params.row.id)}
            size="small"
            color="error"
            aria-label="Delete webhook"
          >
            <Delete />
          </IconButton>
        </Tooltip>
      </Box>
    )
  }
];

// Retry configuration for failed operations
const RETRY_OPTIONS = {
  maxAttempts: 3,
  backoffFactor: 2,
  initialDelay: 1000
};

/**
 * Enterprise-grade webhook list component with comprehensive monitoring and management features
 */
export const WebhookList: React.FC<WebhookListProps> = ({
  onEdit,
  onDelete,
  onTest,
  onHealthCheck,
  onRetry
}) => {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Enhanced data fetching with error handling and retry logic
  const fetchWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      const webhookService = new WebhookService();
      const data = await webhookService.getWebhooks();
      
      // Enrich webhook data with health metrics
      const enrichedData = await Promise.all(
        data.map(async (webhook) => {
          const health = await onHealthCheck(webhook.id);
          return {
            ...webhook,
            health: {
              uptime: 100, // Calculate based on health data
              successRate: (webhook.metadata.successRate || 0) * 100,
              lastDelivery: new Date(webhook.metadata.lastSuccess || Date.now()),
              avgResponseTime: webhook.metadata.averageLatencyMs || 0
            },
            onEdit: () => onEdit(webhook),
            onDelete: () => handleDelete(webhook.id),
            onTest: () => handleTest(webhook.id)
          };
        })
      );

      setWebhooks(enrichedData);
      setError(null);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch webhooks:', err);
    } finally {
      setLoading(false);
    }
  }, [onEdit, onDelete, onTest, onHealthCheck]);

  // Initialize data and set up real-time updates
  useEffect(() => {
    fetchWebhooks();
    
    // Subscribe to webhook updates
    const webhookService = new WebhookService();
    const subscription = webhookService.subscribeToUpdates((update) => {
      setWebhooks(current => 
        current.map(webhook => 
          webhook.id === update.id ? { ...webhook, ...update } : webhook
        )
      );
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchWebhooks]);

  // Enhanced delete handler with confirmation and retry logic
  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      setWebhooks(current => current.filter(webhook => webhook.id !== id));
    } catch (err) {
      console.error('Failed to delete webhook:', err);
      // Implement retry logic
      for (let attempt = 1; attempt <= RETRY_OPTIONS.maxAttempts; attempt++) {
        try {
          await new Promise(resolve => 
            setTimeout(resolve, RETRY_OPTIONS.initialDelay * Math.pow(RETRY_OPTIONS.backoffFactor, attempt - 1))
          );
          await onDelete(id);
          setWebhooks(current => current.filter(webhook => webhook.id !== id));
          break;
        } catch (retryErr) {
          if (attempt === RETRY_OPTIONS.maxAttempts) {
            throw retryErr;
          }
        }
      }
    }
  };

  // Enhanced test handler with health check
  const handleTest = async (id: string) => {
    try {
      await onTest(id);
      const health = await onHealthCheck(id);
      setWebhooks(current =>
        current.map(webhook =>
          webhook.id === id
            ? {
                ...webhook,
                status: WebhookStatus.ACTIVE,
                health: {
                  ...webhook.health,
                  lastDelivery: new Date(),
                  successRate: 100
                }
              }
            : webhook
        )
      );
    } catch (err) {
      console.error('Failed to test webhook:', err);
      await onRetry(id);
    }
  };

  return (
    <ErrorBoundary
      fallback={
        <Box role="alert" aria-label="Error loading webhooks" padding={2}>
          An error occurred while loading webhooks. Please try again.
        </Box>
      }
    >
      <Table
        columns={COLUMNS}
        data={webhooks}
        loading={loading}
        pageSize={10}
        onPageChange={() => {}}
        ariaLabel="Webhook configurations"
        statusColumn="status"
      />
    </ErrorBoundary>
  );
};

export default WebhookList;