import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from '@axe-core/react';
import { customRender } from '../../../tests/utils/test-utils';
import { WebhookConfig } from './WebhookConfig';
import { WebhookService } from '../../../services/webhook.service';
import { WebhookEvent, WebhookStatus } from '../../../interfaces/webhook.interface';

// Mock WebhookService
jest.mock('../../../services/webhook.service');

describe('WebhookConfig Component', () => {
  // Test data setup
  const mockWebhook = {
    id: 'test-webhook-1',
    url: 'https://api.example.com/webhook',
    events: [WebhookEvent.APPLICATION_CREATED],
    status: WebhookStatus.ACTIVE,
    securityConfig: {
      enforceHttps: true,
      signatureHeader: 'X-Webhook-Signature',
      tlsVersion: '1.3',
      allowedIpRanges: [],
      encryptionAlgorithm: 'aes-256-gcm',
      secretRotationDays: 90
    },
    metadata: {
      description: 'Test webhook',
      labels: {},
      version: '1.0.0'
    }
  };

  const mockSecurityOptions = {
    enforceHttps: true,
    signatureHeader: 'X-Webhook-Signature',
    tlsVersion: '1.3',
    allowedIpRanges: [],
    encryptionAlgorithm: 'aes-256-gcm',
    secretRotationDays: 90
  };

  const mockMonitoringConfig = {
    enableHealthCheck: true,
    healthCheckInterval: 300000
  };

  // Mock functions
  const mockOnSave = jest.fn();
  const mockOnTest = jest.fn();
  const mockOnCancel = jest.fn();
  const mockOnHealthCheck = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    WebhookService.prototype.createWebhook = jest.fn();
    WebhookService.prototype.testWebhook = jest.fn();
    WebhookService.prototype.validateSecurity = jest.fn();
  });

  // Rendering tests
  it('renders webhook configuration form correctly', () => {
    customRender(
      <WebhookConfig
        webhook={null}
        onSave={mockOnSave}
        onTest={mockOnTest}
        onCancel={mockOnCancel}
        onHealthCheck={mockOnHealthCheck}
        securityOptions={mockSecurityOptions}
        monitoringConfig={mockMonitoringConfig}
      />
    );

    expect(screen.getByPlaceholderText('Webhook URL')).toBeInTheDocument();
    expect(screen.getByText('Event Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
  });

  // Form validation tests
  it('validates webhook URL format and security requirements', async () => {
    customRender(
      <WebhookConfig
        webhook={null}
        onSave={mockOnSave}
        onTest={mockOnTest}
        onCancel={mockOnCancel}
        onHealthCheck={mockOnHealthCheck}
        securityOptions={mockSecurityOptions}
        monitoringConfig={mockMonitoringConfig}
      />
    );

    const urlInput = screen.getByPlaceholderText('Webhook URL');
    await userEvent.type(urlInput, 'http://localhost:3000');
    
    const saveButton = screen.getByText('Save Configuration');
    fireEvent.click(saveButton);

    expect(await screen.findByText('Invalid webhook URL. HTTPS is required.')).toBeInTheDocument();
  });

  // Event selection tests
  it('handles event selection correctly', async () => {
    customRender(
      <WebhookConfig
        webhook={null}
        onSave={mockOnSave}
        onTest={mockOnTest}
        onCancel={mockOnCancel}
        onHealthCheck={mockOnHealthCheck}
        securityOptions={mockSecurityOptions}
        monitoringConfig={mockMonitoringConfig}
      />
    );

    const applicationCreatedCheckbox = screen.getByLabelText('Application Created');
    await userEvent.click(applicationCreatedCheckbox);

    expect(applicationCreatedCheckbox).toBeChecked();
  });

  // Security configuration tests
  it('enforces security requirements when enabled', async () => {
    customRender(
      <WebhookConfig
        webhook={null}
        onSave={mockOnSave}
        onTest={mockOnTest}
        onCancel={mockOnCancel}
        onHealthCheck={mockOnHealthCheck}
        securityOptions={{ ...mockSecurityOptions, enforceHttps: true }}
        monitoringConfig={mockMonitoringConfig}
      />
    );

    const advancedSettings = screen.getByText('Advanced Settings');
    await userEvent.click(advancedSettings);

    const enforceHttpsSwitch = screen.getByLabelText('Enforce HTTPS');
    expect(enforceHttpsSwitch).toBeChecked();
  });

  // Form submission tests
  it('submits webhook configuration successfully', async () => {
    customRender(
      <WebhookConfig
        webhook={null}
        onSave={mockOnSave}
        onTest={mockOnTest}
        onCancel={mockOnCancel}
        onHealthCheck={mockOnHealthCheck}
        securityOptions={mockSecurityOptions}
        monitoringConfig={mockMonitoringConfig}
      />
    );

    const urlInput = screen.getByPlaceholderText('Webhook URL');
    await userEvent.type(urlInput, 'https://api.example.com/webhook');

    const applicationCreatedCheckbox = screen.getByLabelText('Application Created');
    await userEvent.click(applicationCreatedCheckbox);

    const saveButton = screen.getByText('Save Configuration');
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://api.example.com/webhook',
        events: [WebhookEvent.APPLICATION_CREATED]
      }));
    });
  });

  // Webhook testing functionality
  it('handles webhook testing correctly', async () => {
    customRender(
      <WebhookConfig
        webhook={mockWebhook}
        onSave={mockOnSave}
        onTest={mockOnTest}
        onCancel={mockOnCancel}
        onHealthCheck={mockOnHealthCheck}
        securityOptions={mockSecurityOptions}
        monitoringConfig={mockMonitoringConfig}
      />
    );

    const testButton = screen.getByText('Test Webhook');
    await userEvent.click(testButton);

    await waitFor(() => {
      expect(mockOnTest).toHaveBeenCalledWith(mockWebhook.id);
    });
  });

  // Health check monitoring tests
  it('monitors webhook health status', async () => {
    mockOnHealthCheck.mockResolvedValue(WebhookStatus.ACTIVE);

    customRender(
      <WebhookConfig
        webhook={mockWebhook}
        onSave={mockOnSave}
        onTest={mockOnTest}
        onCancel={mockOnCancel}
        onHealthCheck={mockOnHealthCheck}
        securityOptions={mockSecurityOptions}
        monitoringConfig={mockMonitoringConfig}
      />
    );

    await waitFor(() => {
      expect(mockOnHealthCheck).toHaveBeenCalledWith(mockWebhook.id);
    });
  });

  // Accessibility tests
  it('meets WCAG 2.1 accessibility standards', async () => {
    const { container } = customRender(
      <WebhookConfig
        webhook={mockWebhook}
        onSave={mockOnSave}
        onTest={mockOnTest}
        onCancel={mockOnCancel}
        onHealthCheck={mockOnHealthCheck}
        securityOptions={mockSecurityOptions}
        monitoringConfig={mockMonitoringConfig}
      />
    );

    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // Error handling tests
  it('displays error messages appropriately', async () => {
    mockOnSave.mockRejectedValue(new Error('Failed to save webhook'));

    customRender(
      <WebhookConfig
        webhook={null}
        onSave={mockOnSave}
        onTest={mockOnTest}
        onCancel={mockOnCancel}
        onHealthCheck={mockOnHealthCheck}
        securityOptions={mockSecurityOptions}
        monitoringConfig={mockMonitoringConfig}
      />
    );

    const urlInput = screen.getByPlaceholderText('Webhook URL');
    await userEvent.type(urlInput, 'https://api.example.com/webhook');

    const applicationCreatedCheckbox = screen.getByLabelText('Application Created');
    await userEvent.click(applicationCreatedCheckbox);

    const saveButton = screen.getByText('Save Configuration');
    await userEvent.click(saveButton);

    expect(await screen.findByText('Failed to save webhook')).toBeInTheDocument();
  });

  // Cleanup test
  it('cleans up health check interval on unmount', () => {
    const { unmount } = customRender(
      <WebhookConfig
        webhook={mockWebhook}
        onSave={mockOnSave}
        onTest={mockOnTest}
        onCancel={mockOnCancel}
        onHealthCheck={mockOnHealthCheck}
        securityOptions={mockSecurityOptions}
        monitoringConfig={mockMonitoringConfig}
      />
    );

    unmount();
    // Verify cleanup - no memory leaks
    expect(mockOnHealthCheck).not.toHaveBeenCalledAfter(unmount);
  });
});