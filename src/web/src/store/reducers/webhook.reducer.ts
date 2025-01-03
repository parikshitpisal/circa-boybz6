/**
 * Webhook Redux Reducer
 * Implements webhook integration requirements from Technical Specifications Section 3.3.4
 * @version 1.0.0
 */

import { AnyAction } from 'redux';
import { WebhookConfig, WebhookEvent, WebhookStatus } from '../../interfaces/webhook.interface';

/**
 * Interface for webhook test results tracking
 */
interface WebhookTestResult {
  success: boolean;
  timestamp: Date;
  error?: string;
  responseTime?: number;
}

/**
 * Interface for webhook delivery statistics
 */
interface WebhookDeliveryStats {
  success: number;
  failed: number;
  lastDelivery: Date;
}

/**
 * Enhanced interface for webhook state management
 */
interface WebhookState {
  webhooks: Record<string, WebhookConfig>;
  selectedWebhook: WebhookConfig | null;
  loading: boolean;
  error: string | null;
  testResults: Record<string, WebhookTestResult>;
  deliveryStats: Record<string, WebhookDeliveryStats>;
  lastSync: Date;
}

/**
 * Initial state factory for the webhook reducer
 */
const initialState: WebhookState = {
  webhooks: {},
  selectedWebhook: null,
  loading: false,
  error: null,
  testResults: {},
  deliveryStats: {},
  lastSync: new Date()
};

/**
 * Enhanced reducer for webhook state management
 */
const webhookReducer = (state: WebhookState = initialState, action: AnyAction): WebhookState => {
  switch (action.type) {
    case 'FETCH_WEBHOOKS_REQUEST':
      return {
        ...state,
        loading: true,
        error: null
      };

    case 'FETCH_WEBHOOKS_SUCCESS':
      return {
        ...state,
        webhooks: action.payload.reduce((acc: Record<string, WebhookConfig>, webhook: WebhookConfig) => {
          acc[webhook.id] = webhook;
          return acc;
        }, {}),
        loading: false,
        lastSync: new Date()
      };

    case 'FETCH_WEBHOOKS_FAILURE':
      return {
        ...state,
        loading: false,
        error: action.payload
      };

    case 'FETCH_WEBHOOK_REQUEST':
      return {
        ...state,
        selectedWebhook: null,
        loading: true,
        error: null
      };

    case 'FETCH_WEBHOOK_SUCCESS':
      return {
        ...state,
        selectedWebhook: action.payload,
        loading: false
      };

    case 'FETCH_WEBHOOK_FAILURE':
      return {
        ...state,
        loading: false,
        error: action.payload
      };

    case 'CREATE_WEBHOOK_SUCCESS':
      return {
        ...state,
        webhooks: {
          ...state.webhooks,
          [action.payload.id]: action.payload
        },
        loading: false,
        error: null
      };

    case 'UPDATE_WEBHOOK_SUCCESS':
      return {
        ...state,
        webhooks: {
          ...state.webhooks,
          [action.payload.id]: {
            ...state.webhooks[action.payload.id],
            ...action.payload
          }
        },
        selectedWebhook: action.payload.id === state.selectedWebhook?.id
          ? { ...state.selectedWebhook, ...action.payload }
          : state.selectedWebhook,
        loading: false,
        error: null
      };

    case 'DELETE_WEBHOOK_SUCCESS':
      const { [action.payload]: deletedWebhook, ...remainingWebhooks } = state.webhooks;
      return {
        ...state,
        webhooks: remainingWebhooks,
        selectedWebhook: state.selectedWebhook?.id === action.payload ? null : state.selectedWebhook,
        loading: false,
        error: null
      };

    case 'TEST_WEBHOOK_REQUEST':
      return {
        ...state,
        testResults: {
          ...state.testResults,
          [action.payload.webhookId]: {
            success: false,
            timestamp: new Date(),
            responseTime: 0
          }
        }
      };

    case 'TEST_WEBHOOK_SUCCESS':
      return {
        ...state,
        testResults: {
          ...state.testResults,
          [action.payload.webhookId]: {
            success: true,
            timestamp: new Date(),
            responseTime: action.payload.responseTime
          }
        }
      };

    case 'TEST_WEBHOOK_FAILURE':
      return {
        ...state,
        testResults: {
          ...state.testResults,
          [action.payload.webhookId]: {
            success: false,
            timestamp: new Date(),
            error: action.payload.error
          }
        }
      };

    case 'SYNC_WEBHOOK_STATUS':
      return {
        ...state,
        deliveryStats: {
          ...state.deliveryStats,
          [action.payload.webhookId]: {
            success: action.payload.successCount,
            failed: action.payload.failureCount,
            lastDelivery: new Date(action.payload.lastDelivery)
          }
        },
        webhooks: {
          ...state.webhooks,
          [action.payload.webhookId]: {
            ...state.webhooks[action.payload.webhookId],
            status: action.payload.status
          }
        }
      };

    default:
      return state;
  }
};

export default webhookReducer;