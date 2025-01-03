/**
 * Document Reducer
 * Enhanced Redux reducer for secure document state management with validation and audit logging
 * @version 1.0.0
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Document, DocumentMetadata } from '../../interfaces/document.interface';
import { APPLICATION_STATUS, DOCUMENT_TYPE } from '../../constants/application.constants';

/**
 * Validation status tracking interface
 */
interface ValidationStatus {
  isValid: boolean;
  errors: string[];
  lastValidated: Date;
  validatedBy: string;
}

/**
 * Security context for document access control
 */
interface SecurityContext {
  userId: string;
  permissions: string[];
  accessLevel: string;
  lastAccessed: Date;
  ipAddress: string;
}

/**
 * Processing metrics interface
 */
interface ProcessingMetrics {
  startTime: Date;
  endTime: Date | null;
  duration: number;
  retryCount: number;
  ocrConfidence: number;
}

/**
 * Audit log entry interface
 */
interface AuditLogEntry {
  timestamp: Date;
  action: string;
  userId: string;
  documentId: string;
  details: Record<string, any>;
}

/**
 * Document error tracking interface
 */
interface DocumentError {
  message: string;
  code: string;
  timestamp: Date;
  retryAttempts: number;
  validationErrors: string[];
  securityErrors: string[];
}

/**
 * Document state interface
 */
interface DocumentState {
  documents: Record<string, Document>;
  loading: Record<string, boolean>;
  errors: Record<string, DocumentError>;
  selectedDocumentId: string | null;
  documentSecurity: Record<string, SecurityContext>;
  validationStates: Record<string, ValidationStatus>;
  processingMetrics: Record<string, ProcessingMetrics>;
  auditTrail: AuditLogEntry[];
}

/**
 * Initial state with security and validation tracking
 */
const initialState: DocumentState = {
  documents: {},
  loading: {},
  errors: {},
  selectedDocumentId: null,
  documentSecurity: {},
  validationStates: {},
  processingMetrics: {},
  auditTrail: []
};

/**
 * Document slice with enhanced security and validation
 */
const documentSlice = createSlice({
  name: 'document',
  initialState,
  reducers: {
    setDocumentLoading: (state, action: PayloadAction<{ id: string; loading: boolean }>) => {
      state.loading[action.payload.id] = action.payload.loading;
    },

    addDocument: (state, action: PayloadAction<{ document: Document; securityContext: SecurityContext }>) => {
      const { document, securityContext } = action.payload;
      state.documents[document.id] = document;
      state.documentSecurity[document.id] = securityContext;
      state.processingMetrics[document.id] = {
        startTime: new Date(),
        endTime: null,
        duration: 0,
        retryCount: 0,
        ocrConfidence: document.metadata.ocrConfidence
      };
      
      // Add audit log entry
      state.auditTrail.push({
        timestamp: new Date(),
        action: 'DOCUMENT_ADDED',
        userId: securityContext.userId,
        documentId: document.id,
        details: { documentType: document.type }
      });
    },

    updateDocument: (state, action: PayloadAction<{ 
      id: string; 
      updates: Partial<Document>; 
      securityContext: SecurityContext 
    }>) => {
      const { id, updates, securityContext } = action.payload;
      
      if (state.documents[id] && state.documentSecurity[id]) {
        state.documents[id] = { ...state.documents[id], ...updates };
        
        // Update processing metrics
        if (updates.status === APPLICATION_STATUS.COMPLETED) {
          state.processingMetrics[id] = {
            ...state.processingMetrics[id],
            endTime: new Date(),
            duration: Date.now() - state.processingMetrics[id].startTime.getTime()
          };
        }

        // Add audit log entry
        state.auditTrail.push({
          timestamp: new Date(),
          action: 'DOCUMENT_UPDATED',
          userId: securityContext.userId,
          documentId: id,
          details: { updates }
        });
      }
    },

    setDocumentError: (state, action: PayloadAction<{ 
      id: string; 
      error: DocumentError;
      securityContext: SecurityContext 
    }>) => {
      const { id, error, securityContext } = action.payload;
      state.errors[id] = error;
      
      // Update processing metrics for retry tracking
      if (state.processingMetrics[id]) {
        state.processingMetrics[id].retryCount += 1;
      }

      // Add audit log entry
      state.auditTrail.push({
        timestamp: new Date(),
        action: 'DOCUMENT_ERROR',
        userId: securityContext.userId,
        documentId: id,
        details: { error }
      });
    },

    clearDocumentError: (state, action: PayloadAction<{ id: string; securityContext: SecurityContext }>) => {
      const { id, securityContext } = action.payload;
      delete state.errors[id];

      // Add audit log entry
      state.auditTrail.push({
        timestamp: new Date(),
        action: 'ERROR_CLEARED',
        userId: securityContext.userId,
        documentId: id,
        details: {}
      });
    },

    setSelectedDocument: (state, action: PayloadAction<{ 
      id: string | null; 
      securityContext: SecurityContext 
    }>) => {
      const { id, securityContext } = action.payload;
      state.selectedDocumentId = id;

      if (id) {
        // Add audit log entry for document selection
        state.auditTrail.push({
          timestamp: new Date(),
          action: 'DOCUMENT_SELECTED',
          userId: securityContext.userId,
          documentId: id,
          details: {}
        });
      }
    },

    updateValidationStatus: (state, action: PayloadAction<{ 
      id: string; 
      status: ValidationStatus;
      securityContext: SecurityContext 
    }>) => {
      const { id, status, securityContext } = action.payload;
      state.validationStates[id] = status;

      // Add audit log entry
      state.auditTrail.push({
        timestamp: new Date(),
        action: 'VALIDATION_UPDATED',
        userId: securityContext.userId,
        documentId: id,
        details: { validationStatus: status }
      });
    },

    updateSecurityContext: (state, action: PayloadAction<{ 
      id: string; 
      securityContext: SecurityContext 
    }>) => {
      const { id, securityContext } = action.payload;
      state.documentSecurity[id] = securityContext;

      // Add audit log entry
      state.auditTrail.push({
        timestamp: new Date(),
        action: 'SECURITY_UPDATED',
        userId: securityContext.userId,
        documentId: id,
        details: { securityContext }
      });
    }
  }
});

export const { 
  setDocumentLoading,
  addDocument,
  updateDocument,
  setDocumentError,
  clearDocumentError,
  setSelectedDocument,
  updateValidationStatus,
  updateSecurityContext
} = documentSlice.actions;

export default documentSlice.reducer;