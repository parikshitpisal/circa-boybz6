/**
 * Document Action Creators
 * Implements secure document management operations with enhanced error handling
 * @version 1.0.0
 */

import { createAsyncThunk } from '@reduxjs/toolkit';
import { retry } from 'axios-retry';
import { Document } from '../../interfaces/document.interface';
import { documentService } from '../../services/document.service';

// Action type constants
export const FETCH_DOCUMENT = 'document/fetchDocument';
export const PROCESS_DOCUMENT = 'document/processDocument';

// Retry configuration for document operations
const DOCUMENT_RETRY_CONFIG = {
  retries: 3,
  backoff: 'exponential',
  startDelay: 1000,
  maxDelay: 10000
};

// Security validation configuration
const SECURITY_VALIDATION_CONFIG = {
  validateContext: true,
  validateIntegrity: true,
  auditLog: true
};

/**
 * Fetches document details with security validation and error handling
 */
export const fetchDocument = createAsyncThunk<
  Document,
  { id: string; securityContext: any },
  { rejectValue: { error: string; details: any } }
>(
  FETCH_DOCUMENT,
  async ({ id, securityContext }, { rejectWithValue }) => {
    try {
      // Configure retry behavior
      retry(documentService.getDocument, {
        retries: DOCUMENT_RETRY_CONFIG.retries,
        retryDelay: (retryCount) => {
          return Math.min(
            DOCUMENT_RETRY_CONFIG.startDelay * Math.pow(2, retryCount - 1),
            DOCUMENT_RETRY_CONFIG.maxDelay
          );
        },
        retryCondition: (error) => {
          return error.response?.status === 429 || error.response?.status >= 500;
        }
      });

      // Validate security context if enabled
      if (SECURITY_VALIDATION_CONFIG.validateContext) {
        await documentService.validateSecurityContext(securityContext);
      }

      // Fetch document with security context
      const document = await documentService.getDocument(id, securityContext);

      // Validate document integrity if enabled
      if (SECURITY_VALIDATION_CONFIG.validateIntegrity) {
        await documentService.validateDocument(document.id, {
          requiredFields: ['metadata', 'securityInfo'],
          minConfidence: 0.95,
          allowedTypes: ['BANK_STATEMENT', 'ISO_APPLICATION', 'VOIDED_CHECK']
        });
      }

      return document;
    } catch (error: any) {
      return rejectWithValue({
        error: error.message || 'Failed to fetch document',
        details: {
          documentId: id,
          timestamp: new Date().toISOString(),
          errorCode: error.code,
          securityContext: {
            ...securityContext,
            sensitiveData: '[REDACTED]'
          }
        }
      });
    }
  }
);

/**
 * Processes document with real-time status updates and security validation
 */
export const processDocument = createAsyncThunk<
  void,
  { id: string; securityContext: any },
  { rejectValue: { error: string; details: any } }
>(
  PROCESS_DOCUMENT,
  async ({ id, securityContext }, { rejectWithValue }) => {
    try {
      // Validate security context
      if (SECURITY_VALIDATION_CONFIG.validateContext) {
        await documentService.validateSecurityContext(securityContext);
      }

      // Subscribe to document status updates
      const statusSubscription = documentService.getDocumentStatus(id)
        .subscribe({
          next: (status) => {
            console.debug('Document processing status:', status);
          },
          error: (error) => {
            console.error('Status update error:', error);
          }
        });

      // Process document with security context
      await documentService.processDocument(id, {
        priority: 'normal',
        validateMetadata: true,
        retryOnFailure: true,
        notifyOnCompletion: true
      });

      // Cleanup subscription
      statusSubscription.unsubscribe();
    } catch (error: any) {
      return rejectWithValue({
        error: error.message || 'Failed to process document',
        details: {
          documentId: id,
          timestamp: new Date().toISOString(),
          errorCode: error.code,
          processingMetrics: error.processingMetrics,
          securityContext: {
            ...securityContext,
            sensitiveData: '[REDACTED]'
          }
        }
      });
    }
  }
);