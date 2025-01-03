import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Container, Typography, Button, Dialog, CircularProgress, Tooltip } from '@mui/material';
import { Add, Security, HealthAndSafety } from '@mui/icons-material';

import WebhookList from '../../components/webhooks/WebhookList/WebhookList';
import WebhookConfig from '../../components/webhooks/WebhookConfig/WebhookConfig';
import WebhookService from '../../services/webhook.service';
import Alert from '../../components/common/Alert/Alert';
import { WebhookConfig as IWebhookConfig, WebhookStatus, WebhookSecurityConfig } from '../../interfaces/webhook.interface';

// Enhanced interface for webhook page state management
interface WebhookPageState {
  isConfigOpen: boolean;
  selectedWebhook: IWebhookConfig | null;
  loading: boolean;
  error: string | null;
  healthStatus: Record<string, WebhookStatus>;
  securityStatus: Record<string, boolean>;
}

// Default security configuration based on technical specifications
const DEFAULT_SECURITY_CONFIG: WebhookSecurityConfig = {
  signatureHeader: 'X-Webhook-Signature',
  signatureVersion: 'v1',
  tlsVersion: '1.3',
  allowedIpRanges: [],
  enforceHttps: true,
  encryptionAlgorithm: 'aes-256-gcm',
  secretRotationDays: 90
};

/**
 * Enhanced Webhooks page component for managing webhook configurations
 * Implements webhook integration requirements from Technical Specifications Section 3.3.4
 */
const Webhooks: React.FC = () => {
  // Initialize state with comprehensive tracking
  const [state, setState] = useState<WebhookPageState>({
    isConfigOpen: false,
    selectedWebhook: null,
    loading: false,
    error: null,
    healthStatus: {},
    securityStatus: {}
  });

  // Initialize webhook service
  const webhookService = useMemo(() => new WebhookService(), []);

  // Load webhooks and initialize monitoring
  useEffect(() => {
    const loadWebhooks = async () => {
      setState(prev => ({ ...prev, loading: true }));
      try {
        await refreshWebhookStatus();
      } catch (error) {
        setState(prev => ({
          ...prev,
          error: 'Failed to load webhooks. Please try again.',
          loading: false
        }));
      }
    };

    loadWebhooks();

    // Set up periodic health checks
    const healthCheckInterval = setInterval(refreshWebhookStatus, 300000); // 5 minutes

    return () => clearInterval(healthCheckInterval);
  }, []);

  // Refresh webhook status and health metrics
  const refreshWebhookStatus = async () => {
    try {
      const webhooks = await webhookService.getWebhooks();
      const healthPromises = webhooks.map(webhook => 
        webhookService.verifyWebhookHealth(webhook.id)
      );
      const healthResults = await Promise.allSettled(healthPromises);

      const newHealthStatus: Record<string, WebhookStatus> = {};
      const newSecurityStatus: Record<string, boolean> = {};

      webhooks.forEach((webhook, index) => {
        const healthResult = healthResults[index];
        newHealthStatus[webhook.id] = healthResult.status === 'fulfilled' 
          ? WebhookStatus.ACTIVE 
          : WebhookStatus.FAILED;
        newSecurityStatus[webhook.id] = webhook.securityConfig.enforceHttps;
      });

      setState(prev => ({
        ...prev,
        healthStatus: newHealthStatus,
        securityStatus: newSecurityStatus,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to refresh webhook status',
        loading: false
      }));
    }
  };

  // Handle webhook editing
  const handleEdit = useCallback((webhook: IWebhookConfig) => {
    setState(prev => ({
      ...prev,
      selectedWebhook: webhook,
      isConfigOpen: true
    }));
  }, []);

  // Handle webhook deletion with confirmation
  const handleDelete = useCallback(async (id: string) => {
    try {
      await webhookService.deleteWebhook(id);
      await refreshWebhookStatus();
      setState(prev => ({
        ...prev,
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to delete webhook'
      }));
    }
  }, []);

  // Handle webhook testing with health check
  const handleTest = useCallback(async (id: string) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      await webhookService.testWebhook(id);
      const health = await webhookService.verifyWebhookHealth(id);
      
      setState(prev => ({
        ...prev,
        healthStatus: {
          ...prev.healthStatus,
          [id]: health
        },
        loading: false,
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Webhook test failed',
        loading: false
      }));
    }
  }, []);

  // Handle webhook configuration saving
  const handleSave = useCallback(async (config: IWebhookConfig) => {
    try {
      setState(prev => ({ ...prev, loading: true }));
      
      if (config.id) {
        await webhookService.updateWebhook(config.id, config);
      } else {
        await webhookService.createWebhook(config);
      }

      await refreshWebhookStatus();
      setState(prev => ({
        ...prev,
        isConfigOpen: false,
        selectedWebhook: null,
        error: null
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to save webhook configuration',
        loading: false
      }));
    }
  }, []);

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Webhook Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setState(prev => ({
              ...prev,
              isConfigOpen: true,
              selectedWebhook: null
            }))}
            aria-label="Add new webhook"
          >
            Add Webhook
          </Button>
        </Box>

        {state.error && (
          <Alert
            severity="error"
            message={state.error}
            onClose={() => setState(prev => ({ ...prev, error: null }))}
            autoHideDuration={5000}
          />
        )}

        <WebhookList
          onEdit={handleEdit}
          onDelete={handleDelete}
          onTest={handleTest}
          onHealthCheck={webhookService.verifyWebhookHealth}
        />

        <Dialog
          open={state.isConfigOpen}
          onClose={() => setState(prev => ({
            ...prev,
            isConfigOpen: false,
            selectedWebhook: null
          }))}
          maxWidth="md"
          fullWidth
          aria-labelledby="webhook-config-dialog"
        >
          <WebhookConfig
            webhook={state.selectedWebhook}
            onSave={handleSave}
            onTest={handleTest}
            onCancel={() => setState(prev => ({
              ...prev,
              isConfigOpen: false,
              selectedWebhook: null
            }))}
            onHealthCheck={webhookService.verifyWebhookHealth}
            securityOptions={DEFAULT_SECURITY_CONFIG}
            monitoringConfig={{
              enableHealthCheck: true,
              healthCheckInterval: 300000
            }}
          />
        </Dialog>

        {state.loading && (
          <Box
            sx={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            <CircularProgress />
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Webhooks;