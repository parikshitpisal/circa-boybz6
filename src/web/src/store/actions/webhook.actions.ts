import { Dispatch } from 'redux';
import { ThunkAction } from 'redux-thunk';
import { Logger } from 'winston'; // v3.8.0
import { RetryableError } from 'retry-axios'; // v2.6.0

import { WebhookService } from '../../services/webhook.service';
import { WebhookConfig, WebhookEvent, WebhookStatus } from '../../interfaces/webhook.interface';

// Action Types
export const enum WebhookActionTypes {
  FETCH_WEBHOOKS_REQUEST = '@webhook/FETCH_WEBHOOKS_REQUEST',
  FETCH_WEBHOOKS_SUCCESS = '@webhook/FETCH_WEBHOOKS_SUCCESS',
  FETCH_WEBHOOKS_FAILURE = '@webhook/FETCH_WEBHOOKS_FAILURE',
  
  CREATE_WEBHOOK_REQUEST = '@webhook/CREATE_WEBHOOK_REQUEST',
  CREATE_WEBHOOK_SUCCESS = '@webhook/CREATE_WEBHOOK_SUCCESS',
  CREATE_WEBHOOK_FAILURE = '@webhook/CREATE_WEBHOOK_FAILURE',
  
  UPDATE_WEBHOOK_REQUEST = '@webhook/UPDATE_WEBHOOK_REQUEST',
  UPDATE_WEBHOOK_SUCCESS = '@webhook/UPDATE_WEBHOOK_SUCCESS',
  UPDATE_WEBHOOK_FAILURE = '@webhook/UPDATE_WEBHOOK_FAILURE',
  
  DELETE_WEBHOOK_REQUEST = '@webhook/DELETE_WEBHOOK_REQUEST',
  DELETE_WEBHOOK_SUCCESS = '@webhook/DELETE_WEBHOOK_SUCCESS',
  DELETE_WEBHOOK_FAILURE = '@webhook/DELETE_WEBHOOK_FAILURE',
  
  TEST_WEBHOOK_REQUEST = '@webhook/TEST_WEBHOOK_REQUEST',
  TEST_WEBHOOK_SUCCESS = '@webhook/TEST_WEBHOOK_SUCCESS',
  TEST_WEBHOOK_FAILURE = '@webhook/TEST_WEBHOOK_FAILURE',
  
  VALIDATE_WEBHOOK_REQUEST = '@webhook/VALIDATE_WEBHOOK_REQUEST',
  VALIDATE_WEBHOOK_SUCCESS = '@webhook/VALIDATE_WEBHOOK_SUCCESS',
  VALIDATE_WEBHOOK_FAILURE = '@webhook/VALIDATE_WEBHOOK_FAILURE'
}

// Action Interfaces
interface WebhookAction {
  type: WebhookActionTypes;
  payload?: any;
  error?: Error;
  meta?: {
    timestamp: number;
    requestId: string;
    correlationId: string;
  };
}

// Service Instance
const webhookService = new WebhookService();

// Logger Configuration
const logger = new Logger({
  level: 'info',
  format: Logger.format.json(),
  transports: [
    new Logger.transports.Console({
      format: Logger.format.combine(
        Logger.format.colorize(),
        Logger.format.simple()
      )
    })
  ]
});

// Action Creators
export const fetchWebhooks = (): ThunkAction<Promise<WebhookAction>, any, null, WebhookAction> => {
  return async (dispatch: Dispatch<WebhookAction>) => {
    const requestId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const correlationId = `corr_${Date.now()}`;

    try {
      logger.info('Fetching webhooks', { requestId, correlationId });

      dispatch({
        type: WebhookActionTypes.FETCH_WEBHOOKS_REQUEST,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      });

      const webhooks = await webhookService.getWebhooks();
      const enrichedWebhooks = await Promise.all(
        webhooks.map(async webhook => {
          const healthStatus = await webhookService.checkHealth(webhook.id);
          const isValid = await webhookService.validateHMAC(webhook.id);
          return {
            ...webhook,
            health: healthStatus,
            isValid
          };
        })
      );

      const action: WebhookAction = {
        type: WebhookActionTypes.FETCH_WEBHOOKS_SUCCESS,
        payload: enrichedWebhooks,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      };

      logger.info('Webhooks fetched successfully', {
        requestId,
        correlationId,
        count: enrichedWebhooks.length
      });

      return dispatch(action);

    } catch (error) {
      logger.error('Error fetching webhooks', {
        requestId,
        correlationId,
        error: error.message,
        stack: error.stack
      });

      return dispatch({
        type: WebhookActionTypes.FETCH_WEBHOOKS_FAILURE,
        error,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      });
    }
  };
};

export const createWebhook = (
  config: Partial<WebhookConfig>
): ThunkAction<Promise<WebhookAction>, any, null, WebhookAction> => {
  return async (dispatch: Dispatch<WebhookAction>) => {
    const requestId = `webhook_create_${Date.now()}`;
    const correlationId = `corr_${Date.now()}`;

    try {
      logger.info('Creating webhook', { requestId, correlationId, config });

      dispatch({
        type: WebhookActionTypes.CREATE_WEBHOOK_REQUEST,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      });

      const webhook = await webhookService.createWebhook(config);
      
      const action: WebhookAction = {
        type: WebhookActionTypes.CREATE_WEBHOOK_SUCCESS,
        payload: webhook,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      };

      logger.info('Webhook created successfully', {
        requestId,
        correlationId,
        webhookId: webhook.id
      });

      return dispatch(action);

    } catch (error) {
      logger.error('Error creating webhook', {
        requestId,
        correlationId,
        error: error.message,
        stack: error.stack
      });

      return dispatch({
        type: WebhookActionTypes.CREATE_WEBHOOK_FAILURE,
        error,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      });
    }
  };
};

export const updateWebhook = (
  id: string,
  updates: Partial<WebhookConfig>
): ThunkAction<Promise<WebhookAction>, any, null, WebhookAction> => {
  return async (dispatch: Dispatch<WebhookAction>) => {
    const requestId = `webhook_update_${Date.now()}`;
    const correlationId = `corr_${Date.now()}`;

    try {
      logger.info('Updating webhook', { requestId, correlationId, id, updates });

      dispatch({
        type: WebhookActionTypes.UPDATE_WEBHOOK_REQUEST,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      });

      const webhook = await webhookService.updateWebhook(id, updates);
      const healthStatus = await webhookService.checkHealth(id);

      const action: WebhookAction = {
        type: WebhookActionTypes.UPDATE_WEBHOOK_SUCCESS,
        payload: { ...webhook, health: healthStatus },
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      };

      logger.info('Webhook updated successfully', {
        requestId,
        correlationId,
        webhookId: id
      });

      return dispatch(action);

    } catch (error) {
      logger.error('Error updating webhook', {
        requestId,
        correlationId,
        error: error.message,
        stack: error.stack
      });

      return dispatch({
        type: WebhookActionTypes.UPDATE_WEBHOOK_FAILURE,
        error,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      });
    }
  };
};

export const testWebhook = (
  id: string
): ThunkAction<Promise<WebhookAction>, any, null, WebhookAction> => {
  return async (dispatch: Dispatch<WebhookAction>) => {
    const requestId = `webhook_test_${Date.now()}`;
    const correlationId = `corr_${Date.now()}`;

    try {
      logger.info('Testing webhook', { requestId, correlationId, id });

      dispatch({
        type: WebhookActionTypes.TEST_WEBHOOK_REQUEST,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      });

      const testResult = await webhookService.testWebhook(id);
      
      const action: WebhookAction = {
        type: WebhookActionTypes.TEST_WEBHOOK_SUCCESS,
        payload: { id, testResult },
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      };

      logger.info('Webhook tested successfully', {
        requestId,
        correlationId,
        webhookId: id,
        testResult
      });

      return dispatch(action);

    } catch (error) {
      logger.error('Error testing webhook', {
        requestId,
        correlationId,
        error: error.message,
        stack: error.stack
      });

      return dispatch({
        type: WebhookActionTypes.TEST_WEBHOOK_FAILURE,
        error,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      });
    }
  };
};

export const deleteWebhook = (
  id: string
): ThunkAction<Promise<WebhookAction>, any, null, WebhookAction> => {
  return async (dispatch: Dispatch<WebhookAction>) => {
    const requestId = `webhook_delete_${Date.now()}`;
    const correlationId = `corr_${Date.now()}`;

    try {
      logger.info('Deleting webhook', { requestId, correlationId, id });

      dispatch({
        type: WebhookActionTypes.DELETE_WEBHOOK_REQUEST,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      });

      await webhookService.deleteWebhook(id);
      
      const action: WebhookAction = {
        type: WebhookActionTypes.DELETE_WEBHOOK_SUCCESS,
        payload: { id },
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      };

      logger.info('Webhook deleted successfully', {
        requestId,
        correlationId,
        webhookId: id
      });

      return dispatch(action);

    } catch (error) {
      logger.error('Error deleting webhook', {
        requestId,
        correlationId,
        error: error.message,
        stack: error.stack
      });

      return dispatch({
        type: WebhookActionTypes.DELETE_WEBHOOK_FAILURE,
        error,
        meta: {
          timestamp: Date.now(),
          requestId,
          correlationId
        }
      });
    }
  };
};