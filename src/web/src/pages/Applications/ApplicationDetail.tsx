import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Grid, 
  Typography, 
  Button, 
  CircularProgress, 
  Alert,
  Box
} from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

import DashboardLayout from '../../layouts/DashboardLayout';
import DocumentViewer from '../../components/documents/DocumentViewer/DocumentViewer';
import { useDocumentViewer } from '../../hooks/useDocumentViewer';
import { IApplication } from '../../interfaces/application.interface';
import { useAuth } from '../../hooks/useAuth';
import { useAuditLogger } from '@company/audit-logger';
import { apiService } from '../../services/api.service';

interface ApplicationDetailState {
  application: IApplication | null;
  loading: boolean;
  error: string | null;
  documentAccess: {
    canView: boolean;
    canEdit: boolean;
  };
}

const ApplicationDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, validateDevice } = useAuth();
  const auditLogger = useAuditLogger();
  const [state, setState] = useState<ApplicationDetailState>({
    application: null,
    loading: true,
    error: null,
    documentAccess: {
      canView: false,
      canEdit: false
    }
  });

  // Fetch application data with security validation
  const fetchApplication = useCallback(async () => {
    try {
      // Validate device security
      const isDeviceValid = await validateDevice();
      if (!isDeviceValid) {
        throw new Error('Invalid device detected');
      }

      const response = await apiService.get<IApplication>(`/applications/${id}`);
      
      // Log access attempt
      auditLogger.log('application_access', {
        applicationId: id,
        userId: user?.id,
        action: 'VIEW',
        timestamp: new Date()
      });

      // Determine document access permissions
      const documentAccess = {
        canView: ['ADMIN', 'OPERATOR'].includes(user?.role || ''),
        canEdit: user?.role === 'ADMIN'
      };

      setState(prev => ({
        ...prev,
        application: response,
        documentAccess,
        loading: false
      }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load application';
      
      auditLogger.error('application_access_failed', {
        applicationId: id,
        userId: user?.id,
        error: errorMessage
      });

      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false
      }));
    }
  }, [id, user, validateDevice, auditLogger]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  // Handle data updates with audit logging
  const handleDataUpdate = useCallback(async (updatedData: Record<string, any>) => {
    try {
      setState(prev => ({ ...prev, loading: true }));

      await apiService.patch(`/applications/${id}`, updatedData);
      
      auditLogger.log('application_update', {
        applicationId: id,
        userId: user?.id,
        changes: updatedData,
        timestamp: new Date()
      });

      await fetchApplication();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Update failed';
      
      auditLogger.error('application_update_failed', {
        applicationId: id,
        userId: user?.id,
        error: errorMessage
      });

      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false
      }));
    }
  }, [id, user, fetchApplication, auditLogger]);

  // Error boundary fallback
  const ErrorFallback = useCallback(({ error }: { error: Error }) => (
    <Alert 
      severity="error"
      sx={{ m: 2 }}
      action={
        <Button color="inherit" onClick={() => navigate('/applications')}>
          Return to Applications
        </Button>
      }
    >
      {error.message}
    </Alert>
  ), [navigate]);

  if (state.loading) {
    return (
      <DashboardLayout>
        <Box 
          display="flex" 
          justifyContent="center" 
          alignItems="center" 
          minHeight="400px"
        >
          <CircularProgress />
        </Box>
      </DashboardLayout>
    );
  }

  if (state.error) {
    return (
      <DashboardLayout>
        <Alert severity="error" sx={{ m: 2 }}>
          {state.error}
        </Alert>
      </DashboardLayout>
    );
  }

  if (!state.application) {
    return (
      <DashboardLayout>
        <Alert severity="warning" sx={{ m: 2 }}>
          Application not found
        </Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ErrorBoundary FallbackComponent={ErrorFallback}>
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" gutterBottom>
            Application Details
          </Typography>

          <Grid container spacing={3}>
            {/* Document Viewer Section */}
            <Grid item xs={12}>
              {state.documentAccess.canView ? (
                <DocumentViewer
                  document={state.application.documents[0]}
                  onDataChange={handleDataUpdate}
                  readOnly={!state.documentAccess.canEdit}
                  accessToken={user?.accessToken || ''}
                />
              ) : (
                <Alert severity="warning">
                  You don't have permission to view documents
                </Alert>
              )}
            </Grid>

            {/* Application Status Section */}
            <Grid item xs={12}>
              <Alert 
                severity="info"
                sx={{ mt: 2 }}
              >
                Application Status: {state.application.status}
              </Alert>
            </Grid>
          </Grid>
        </Box>
      </ErrorBoundary>
    </DashboardLayout>
  );
};

export default ApplicationDetail;