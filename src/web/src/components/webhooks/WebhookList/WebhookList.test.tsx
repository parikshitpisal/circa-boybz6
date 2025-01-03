import React from 'react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { customRender, screen, fireEvent, within } from '../../../tests/utils/test-utils';
import { WebhookList } from './WebhookList';
import { WebhookConfig, WebhookEvent, WebhookStatus } from '../../../interfaces/webhook.interface';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock handlers with security validation
const mockHandlers = {
  onEdit: jest.fn().mockImplementation((webhook: WebhookConfig) => {
    // Validate permissions before edit
    if (!webhook.securityConfig.allowedIpRanges.includes('127.0.0.1')) {
      throw new Error('Unauthorized IP address');
    }
    return Promise.resolve();
  }),
  onDelete: jest.fn().mockImplementation((id: string) => {
    // Require confirmation for deletion
    return Promise.resolve();
  }),
  onTest: jest.fn().mockImplementation((id: string) => {
    // Implement rate limiting
    const now = Date.now();
    const lastTest = mockHandlers.testHistory.get(id) || 0;
    if (now - lastTest < 5000) { // 5 second cooldown
      throw new Error('Rate limit exceeded');
    }
    mockHandlers.testHistory.set(id, now);
    return Promise.resolve();
  }),
  testHistory: new Map<string, number>()
};

// Generate mock webhooks with security attributes
const generateMockWebhooks = (count: number = 2): WebhookConfig[] => {
  return Array.from({ length: count }, (_, index) => ({
    id: `webhook-${index + 1}`,
    url: `https://api.example.com/webhook${index + 1}`,
    events: [WebhookEvent.APPLICATION_CREATED, WebhookEvent.APPLICATION_UPDATED],
    status: WebhookStatus.ACTIVE,
    secret: 'mock-secret',
    retryConfig: {
      maxRetries: 3,
      backoffRate: 2,
      initialDelay: 1000,
      maxDelay: 32000,
      enableJitter: true,
      timeoutSeconds: 30
    },
    securityConfig: {
      signatureHeader: 'X-Webhook-Signature',
      signatureVersion: 'v1',
      tlsVersion: '1.3',
      allowedIpRanges: ['127.0.0.1'],
      enforceHttps: true,
      encryptionAlgorithm: 'aes-256-gcm',
      secretRotationDays: 90
    },
    metadata: {
      createdById: 'user-1',
      createdByEmail: 'test@example.com',
      lastSuccess: new Date(),
      successRate: 0.95,
      failureCount: 2,
      averageLatencyMs: 250
    }
  }));
};

describe('WebhookList Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHandlers.testHistory.clear();
  });

  describe('Accessibility Compliance', () => {
    it('should meet WCAG 2.1 Level AA requirements', async () => {
      const { container } = customRender(
        <WebhookList 
          webhooks={generateMockWebhooks()}
          loading={false}
          error={null}
          {...mockHandlers}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      customRender(
        <WebhookList 
          webhooks={generateMockWebhooks()}
          loading={false}
          error={null}
          {...mockHandlers}
        />
      );

      const firstRow = screen.getByRole('row', { name: /webhook-1/i });
      const editButton = within(firstRow).getByRole('button', { name: /edit/i });
      
      // Test keyboard navigation
      editButton.focus();
      expect(document.activeElement).toBe(editButton);
      
      fireEvent.keyDown(editButton, { key: 'Enter' });
      expect(mockHandlers.onEdit).toHaveBeenCalled();
    });

    it('should provide proper ARIA labels and roles', () => {
      customRender(
        <WebhookList 
          webhooks={generateMockWebhooks()}
          loading={false}
          error={null}
          {...mockHandlers}
        />
      );

      expect(screen.getByRole('grid')).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2 rows
      expect(screen.getByRole('columnheader', { name: /endpoint url/i })).toBeInTheDocument();
    });
  });

  describe('Security Features', () => {
    it('should validate permissions before edit action', async () => {
      const webhooks = generateMockWebhooks();
      webhooks[0].securityConfig.allowedIpRanges = ['192.168.1.1']; // Unauthorized IP

      customRender(
        <WebhookList 
          webhooks={webhooks}
          loading={false}
          error={null}
          {...mockHandlers}
        />
      );

      const editButton = screen.getAllByRole('button', { name: /edit/i })[0];
      await userEvent.click(editButton);

      expect(mockHandlers.onEdit).toThrow('Unauthorized IP address');
    });

    it('should enforce rate limiting on test action', async () => {
      customRender(
        <WebhookList 
          webhooks={generateMockWebhooks()}
          loading={false}
          error={null}
          {...mockHandlers}
        />
      );

      const testButton = screen.getAllByRole('button', { name: /test/i })[0];
      
      // First test should succeed
      await userEvent.click(testButton);
      expect(mockHandlers.onTest).toHaveBeenCalledTimes(1);

      // Second immediate test should fail
      await userEvent.click(testButton);
      expect(mockHandlers.onTest).toThrow('Rate limit exceeded');
    });
  });

  describe('Performance Metrics', () => {
    it('should render large datasets efficiently', async () => {
      const startTime = performance.now();
      
      customRender(
        <WebhookList 
          webhooks={generateMockWebhooks(100)}
          loading={false}
          error={null}
          {...mockHandlers}
        />
      );

      const renderTime = performance.now() - startTime;
      expect(renderTime).toBeLessThan(1000); // Should render within 1 second
    });

    it('should handle loading state gracefully', () => {
      customRender(
        <WebhookList 
          webhooks={[]}
          loading={true}
          error={null}
          {...mockHandlers}
        />
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should handle error states appropriately', () => {
      customRender(
        <WebhookList 
          webhooks={[]}
          loading={false}
          error="Failed to load webhooks"
          {...mockHandlers}
        />
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load webhooks');
    });
  });

  describe('Data Display and Interaction', () => {
    it('should display webhook information correctly', () => {
      const webhooks = generateMockWebhooks();
      customRender(
        <WebhookList 
          webhooks={webhooks}
          loading={false}
          error={null}
          {...mockHandlers}
        />
      );

      webhooks.forEach(webhook => {
        expect(screen.getByText(webhook.url)).toBeInTheDocument();
        webhook.events.forEach(event => {
          expect(screen.getByText(event.replace('_', ' '))).toBeInTheDocument();
        });
      });
    });

    it('should handle webhook status updates', async () => {
      const webhooks = generateMockWebhooks();
      const { rerender } = customRender(
        <WebhookList 
          webhooks={webhooks}
          loading={false}
          error={null}
          {...mockHandlers}
        />
      );

      // Update webhook status
      webhooks[0].status = WebhookStatus.FAILED;
      rerender(
        <WebhookList 
          webhooks={webhooks}
          loading={false}
          error={null}
          {...mockHandlers}
        />
      );

      expect(screen.getByText('FAILED')).toBeInTheDocument();
    });
  });
});