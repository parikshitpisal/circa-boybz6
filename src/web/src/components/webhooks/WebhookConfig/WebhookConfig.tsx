import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Button,
  Checkbox,
  FormControlLabel,
  Grid,
  Alert,
  CircularProgress,
  Tooltip,
  Collapse,
  Input,
  Select,
  Switch,
} from '@mui/material';
import { useTheme, styled } from '@mui/material/styles';

import {
  WebhookConfig as IWebhookConfig,
  WebhookEvent,
  WebhookStatus,
  WebhookSecurityConfig,
  WebhookMonitoringConfig
} from '../../../interfaces/webhook.interface';
import WebhookService from '../../../services/webhook.service';

// Styled components for enhanced UI
const StyledCard = styled(Card)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  boxShadow: theme.shadows[2]
}));

const StyledFormSection = styled('div')(({ theme }) => ({
  marginBottom: theme.spacing(3),
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.background.paper
}));

interface WebhookConfigProps {
  webhook: IWebhookConfig | null;
  onSave: (config: IWebhookConfig) => Promise<void>;
  onTest: (id: string) => Promise<void>;
  onCancel: () => void;
  onHealthCheck: (id: string) => Promise<WebhookStatus>;
  securityOptions: WebhookSecurityConfig;
  monitoringConfig: WebhookMonitoringConfig;
}

const WebhookConfig: React.FC<WebhookConfigProps> = React.memo(({
  webhook,
  onSave,
  onTest,
  onCancel,
  onHealthCheck,
  securityOptions,
  monitoringConfig
}) => {
  const theme = useTheme();
  const [formData, setFormData] = useState<Partial<IWebhookConfig>>({
    url: '',
    events: [],
    status: WebhookStatus.ACTIVE,
    securityConfig: securityOptions,
    metadata: {
      description: '',
      labels: {},
      version: '1.0.0'
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<WebhookStatus | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const healthCheckInterval = useRef<NodeJS.Timeout>();
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Initialize form with webhook data if editing
  useEffect(() => {
    if (webhook) {
      setFormData({
        ...webhook,
        securityConfig: {
          ...securityOptions,
          ...webhook.securityConfig
        }
      });
    }
  }, [webhook, securityOptions]);

  // Setup health check monitoring
  useEffect(() => {
    if (webhook?.id && monitoringConfig.enableHealthCheck) {
      healthCheckInterval.current = setInterval(() => {
        onHealthCheck(webhook.id).then(setTestStatus);
      }, monitoringConfig.healthCheckInterval || 300000);

      return () => {
        if (healthCheckInterval.current) {
          clearInterval(healthCheckInterval.current);
        }
      };
    }
  }, [webhook?.id, monitoringConfig, onHealthCheck]);

  // Validate URL with security requirements
  const validateUrl = useCallback((url: string): boolean => {
    try {
      const parsedUrl = new URL(url);
      return (
        (securityOptions.enforceHttps ? parsedUrl.protocol === 'https:' : true) &&
        parsedUrl.hostname !== 'localhost' &&
        parsedUrl.hostname !== '127.0.0.1'
      );
    } catch {
      return false;
    }
  }, [securityOptions.enforceHttps]);

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!formData.url || !validateUrl(formData.url)) {
        throw new Error('Invalid webhook URL. HTTPS is required.');
      }

      if (!formData.events?.length) {
        throw new Error('At least one event must be selected.');
      }

      const webhookService = new WebhookService();
      const config: IWebhookConfig = {
        ...formData as IWebhookConfig,
        securityConfig: {
          ...securityOptions,
          ...formData.securityConfig
        }
      };

      await onSave(config);
      
      if (webhook?.id) {
        await webhookService.updateWebhook(webhook.id, config);
      } else {
        await webhookService.createWebhook(config);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save webhook configuration');
    } finally {
      setLoading(false);
    }
  };

  // Handle webhook testing
  const handleTest = async () => {
    if (!webhook?.id) return;
    
    setLoading(true);
    try {
      await onTest(webhook.id);
      const status = await onHealthCheck(webhook.id);
      setTestStatus(status);
    } catch (err) {
      setError('Webhook test failed. Please verify the endpoint configuration.');
    } finally {
      setLoading(false);
    }
  };

  // Available webhook events with descriptions
  const availableEvents = useMemo(() => [
    { value: WebhookEvent.APPLICATION_CREATED, label: 'Application Created', description: 'Triggered when a new application is created' },
    { value: WebhookEvent.APPLICATION_UPDATED, label: 'Application Updated', description: 'Triggered when an application is modified' },
    { value: WebhookEvent.APPLICATION_COMPLETED, label: 'Application Completed', description: 'Triggered when an application is finalized' },
    { value: WebhookEvent.DOCUMENT_PROCESSED, label: 'Document Processed', description: 'Triggered when a document completes processing' },
    { value: WebhookEvent.OCR_COMPLETED, label: 'OCR Completed', description: 'Triggered when OCR processing finishes' }
  ], []);

  return (
    <StyledCard>
      <form onSubmit={handleSubmit}>
        <CardContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <StyledFormSection>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Input
                  fullWidth
                  placeholder="Webhook URL"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  error={!validateUrl(formData.url || '')}
                  inputRef={urlInputRef}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showAdvanced}
                      onChange={(e) => setShowAdvanced(e.target.checked)}
                    />
                  }
                  label="Advanced Settings"
                />
              </Grid>
            </Grid>
          </StyledFormSection>

          <Collapse in={showAdvanced}>
            <StyledFormSection>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <h4>Security Configuration</h4>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.securityConfig?.enforceHttps}
                        onChange={(e) => setFormData({
                          ...formData,
                          securityConfig: {
                            ...formData.securityConfig,
                            enforceHttps: e.target.checked
                          }
                        })}
                      />
                    }
                    label="Enforce HTTPS"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Input
                    fullWidth
                    placeholder="Signature Header"
                    value={formData.securityConfig?.signatureHeader}
                    onChange={(e) => setFormData({
                      ...formData,
                      securityConfig: {
                        ...formData.securityConfig,
                        signatureHeader: e.target.value
                      }
                    })}
                  />
                </Grid>
              </Grid>
            </StyledFormSection>
          </Collapse>

          <StyledFormSection>
            <h4>Event Subscriptions</h4>
            <Grid container spacing={1}>
              {availableEvents.map((event) => (
                <Grid item xs={12} sm={6} key={event.value}>
                  <Tooltip title={event.description}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={formData.events?.includes(event.value)}
                          onChange={(e) => {
                            const events = e.target.checked
                              ? [...(formData.events || []), event.value]
                              : (formData.events || []).filter(ev => ev !== event.value);
                            setFormData({ ...formData, events });
                          }}
                        />
                      }
                      label={event.label}
                    />
                  </Tooltip>
                </Grid>
              ))}
            </Grid>
          </StyledFormSection>

          {testStatus && (
            <Alert
              severity={testStatus === WebhookStatus.ACTIVE ? 'success' : 'warning'}
              sx={{ mt: 2 }}
            >
              Webhook Status: {testStatus}
            </Alert>
          )}
        </CardContent>

        <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
          <Button onClick={onCancel}>
            Cancel
          </Button>
          {webhook?.id && (
            <Button
              onClick={handleTest}
              disabled={loading}
              color="info"
            >
              Test Webhook
            </Button>
          )}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Save Configuration'}
          </Button>
        </CardActions>
      </form>
    </StyledCard>
  );
});

WebhookConfig.displayName = 'WebhookConfig';

export default WebhookConfig;