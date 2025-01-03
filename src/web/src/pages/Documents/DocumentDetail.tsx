import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Grid,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  Box
} from '@mui/material';
import DocumentViewer from '../../components/documents/DocumentViewer/DocumentViewer';
import { Document } from '../../interfaces/document.interface';
import { documentService } from '../../services/document.service';
import { ErrorBoundary } from 'react-error-boundary';
import { APPLICATION_STATUS } from '../../constants/application.constants';

// Error state interface
interface ErrorState {
  message: string;
  code: string;
  retryable: boolean;
}

// Validation state interface
interface ValidationState {
  isValid: boolean;
  errors: string[];
  lastChecked: Date;
}

// Access state interface
interface AccessState {
  hasAccess: boolean;
  permissions: string[];
  lastVerified: Date;
}

// Component state interface
interface DocumentDetailState {
  document: Document | null;
  loading: boolean;
  error: ErrorState | null;
  validationState: ValidationState;
  accessState: AccessState;
  processingStatus: string | null;
  snackbar: {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  };
}

/**
 * DocumentDetail component for displaying and managing document details
 * with enhanced security, validation, and accessibility features
 */
const DocumentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const processingInterval = useRef<NodeJS.Timeout>();

  // Initialize component state
  const [state, setState] = useState<DocumentDetailState>({
    document: null,
    loading: true,
    error: null,
    validationState: {
      isValid: false,
      errors: [],
      lastChecked: new Date()
    },
    accessState: {
      hasAccess: false,
      permissions: [],
      lastVerified: new Date()
    },
    processingStatus: null,
    snackbar: {
      open: false,
      message: '',
      severity: 'info'
    }
  });

  /**
   * Securely fetches document with validation and access control
   */
  const fetchDocument = useCallback(async () => {
    if (!id) return;

    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Validate access permissions
      const securityContext = {
        userId: localStorage.getItem('userId'),
        action: 'view',
        timestamp: new Date()
      };

      // Log access attempt
      await documentService.logDocumentAccess({
        documentId: id,
        action: 'VIEW',
        timestamp: new Date()
      });

      // Fetch document with security context
      const document = await documentService.getDocument(id, securityContext);

      // Validate document integrity
      const validationResult = await documentService.validateDocument(id, {
        requiredFields: ['type', 'status', 'metadata'],
        minConfidence: 0.8,
        allowedTypes: ['BANK_STATEMENT', 'ISO_APPLICATION', 'VOIDED_CHECK']
      });

      setState(prev => ({
        ...prev,
        document,
        loading: false,
        validationState: {
          isValid: validationResult,
          errors: [],
          lastChecked: new Date()
        },
        accessState: {
          hasAccess: true,
          permissions: ['view', 'download'],
          lastVerified: new Date()
        }
      }));

      // Start monitoring processing status if document is being processed
      if (document.status === APPLICATION_STATUS.PROCESSING) {
        startProcessingMonitor(id);
      }

    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: {
          message: error.message || 'Failed to load document',
          code: error.code || 'UNKNOWN_ERROR',
          retryable: error.retryable || false
        },
        snackbar: {
          open: true,
          message: 'Error loading document',
          severity: 'error'
        }
      }));
    }
  }, [id]);

  /**
   * Monitors document processing status
   */
  const startProcessingMonitor = useCallback((documentId: string) => {
    if (processingInterval.current) {
      clearInterval(processingInterval.current);
    }

    processingInterval.current = setInterval(async () => {
      try {
        const status = await documentService.getDocumentStatus(documentId);
        setState(prev => ({
          ...prev,
          processingStatus: status.status,
          document: prev.document ? { ...prev.document, status: status.status } : null
        }));

        if (status.status === APPLICATION_STATUS.COMPLETED || 
            status.status === APPLICATION_STATUS.FAILED) {
          clearInterval(processingInterval.current);
        }
      } catch (error) {
        console.error('Failed to fetch processing status:', error);
      }
    }, 5000);
  }, []);

  /**
   * Handles document data changes with validation
   */
  const handleDataChange = useCallback(async (data: Record<string, any>, validationResult: any) => {
    if (!state.document?.id) return;

    try {
      await documentService.processDocument(state.document.id, {
        priority: 'normal',
        validateMetadata: true,
        notifyOnCompletion: true
      });

      setState(prev => ({
        ...prev,
        snackbar: {
          open: true,
          message: 'Document updated successfully',
          severity: 'success'
        }
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        snackbar: {
          open: true,
          message: 'Failed to update document',
          severity: 'error'
        }
      }));
    }
  }, [state.document?.id]);

  // Initialize document fetch
  useEffect(() => {
    fetchDocument();
    return () => {
      if (processingInterval.current) {
        clearInterval(processingInterval.current);
      }
    };
  }, [fetchDocument]);

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setState(prev => ({
      ...prev,
      snackbar: { ...prev.snackbar, open: false }
    }));
  };

  if (state.loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress 
          size={40}
          aria-label="Loading document details"
        />
      </Box>
    );
  }

  if (state.error) {
    return (
      <Alert 
        severity="error"
        action={
          state.error.retryable && (
            <Button 
              color="inherit" 
              size="small"
              onClick={fetchDocument}
            >
              Retry
            </Button>
          )
        }
      >
        {state.error.message}
      </Alert>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <Alert severity="error">
          An unexpected error occurred. Please try again later.
        </Alert>
      }
    >
      <Box
        component="main"
        role="main"
        aria-label="Document details page"
      >
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h4" component="h1" gutterBottom>
              Document Details
            </Typography>
          </Grid>

          {state.document && (
            <Grid item xs={12}>
              <DocumentViewer
                document={state.document}
                onDataChange={handleDataChange}
                readOnly={!state.accessState.permissions.includes('edit')}
                accessToken={localStorage.getItem('authToken') || ''}
              />
            </Grid>
          )}
        </Grid>

        <Snackbar
          open={state.snackbar.open}
          autoHideDuration={6000}
          onClose={handleSnackbarClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert 
            onClose={handleSnackbarClose} 
            severity={state.snackbar.severity}
          >
            {state.snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ErrorBoundary>
  );
};

export default DocumentDetail;