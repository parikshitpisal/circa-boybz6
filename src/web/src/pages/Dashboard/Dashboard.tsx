import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Grid, Box, CircularProgress } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal Components
import ApplicationQueue from '../../components/dashboard/ApplicationQueue/ApplicationQueue';
import ProcessingStatus from '../../components/dashboard/ProcessingStatus/ProcessingStatus';
import RecentActivity from '../../components/dashboard/RecentActivity/RecentActivity';

// Actions and Types
import { fetchApplications } from '../../store/actions/application.actions';
import { APPLICATION_STATUS } from '../../constants/application.constants';
import type { IApplication } from '../../interfaces/application.interface';

// Constants
const REFRESH_INTERVAL = 30000; // 30 seconds
const PAGE_SIZE = 25;

/**
 * Dashboard component that displays real-time application processing metrics,
 * recent activity, and application queue status
 */
const Dashboard: React.FC = React.memo(() => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Local state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTimer, setRefreshTimer] = useState<NodeJS.Timeout | null>(null);

  // Redux state
  const applications = useSelector((state: any) => state.applications.items);
  const isProcessing = useSelector((state: any) => state.applications.loading);

  /**
   * Fetches application data with error handling
   */
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      await dispatch(fetchApplications({
        page: 0,
        limit: PAGE_SIZE,
        filters: {
          status: undefined // Fetch all statuses
        }
      }));
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch applications:', err);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Sets up periodic data refresh
   */
  const setupRefreshTimer = useCallback(() => {
    if (refreshTimer) {
      clearInterval(refreshTimer);
    }

    const timer = setInterval(() => {
      fetchData();
    }, REFRESH_INTERVAL);

    setRefreshTimer(timer);
    return timer;
  }, [fetchData, refreshTimer]);

  // Initial data fetch and refresh timer setup
  useEffect(() => {
    fetchData();
    const timer = setupRefreshTimer();

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [fetchData, setupRefreshTimer]);

  /**
   * Handles navigation to application detail view
   */
  const handleViewApplication = useCallback((applicationId: string) => {
    navigate(`/applications/${applicationId}`);
  }, [navigate]);

  /**
   * Handles navigation to application edit view
   */
  const handleEditApplication = useCallback((applicationId: string) => {
    navigate(`/applications/${applicationId}/edit`);
  }, [navigate]);

  /**
   * Error fallback component
   */
  const ErrorFallback = ({ error }: { error: Error }) => (
    <Box
      role="alert"
      sx={{
        p: 3,
        color: 'error.main',
        textAlign: 'center'
      }}
    >
      <h2>Dashboard Error</h2>
      <p>{error.message}</p>
      <button onClick={fetchData}>Retry</button>
    </Box>
  );

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress
          size={40}
          aria-label="Loading dashboard data..."
        />
      </Box>
    );
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Box
        component="main"
        role="main"
        aria-label="Application Dashboard"
        sx={{ p: 3 }}
      >
        <Grid
          container
          spacing={3}
          sx={{ minHeight: '100vh' }}
        >
          {/* Processing Status Section */}
          <Grid item xs={12} md={4}>
            <ProcessingStatus
              applications={applications}
              loading={isProcessing}
              onError={(err) => setError(err)}
            />
          </Grid>

          {/* Application Queue Section */}
          <Grid item xs={12} md={8}>
            <ApplicationQueue
              pageSize={PAGE_SIZE}
              status={APPLICATION_STATUS.PENDING}
              realtimeUpdates={true}
            />
          </Grid>

          {/* Recent Activity Section */}
          <Grid item xs={12}>
            <RecentActivity
              applications={applications}
              loading={isProcessing}
              onViewApplication={handleViewApplication}
              onEditApplication={handleEditApplication}
              error={error}
            />
          </Grid>
        </Grid>
      </Box>
    </ErrorBoundary>
  );
});

// Display name for debugging
Dashboard.displayName = 'Dashboard';

export default Dashboard;