import React, { useState, useEffect, useCallback } from 'react';
import { Grid, Typography, CircularProgress, Alert } from '@mui/material'; // ^5.0.0
import Card from '../../common/Card/Card';
import { useApi } from '../../../hooks/useApi';
import { IApplication } from '../../../interfaces/application.interface';
import { APPLICATION_STATUS } from '../../../constants/application.constants';
import { styled } from '@mui/material/styles';

// Styled components for enhanced visual presentation
const StatisticsCard = styled(Card)(({ theme }) => ({
  minHeight: '120px',
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  position: 'relative'
}));

const MetricValue = styled(Typography)(({ theme }) => ({
  fontSize: '24px',
  fontWeight: 'bold',
  color: theme.palette.primary.main,
  marginTop: theme.spacing(1)
}));

const LoadingOverlay = styled('div')({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  zIndex: 1
});

// Interface for component props
interface StatisticsProps {
  refreshInterval?: number; // Refresh interval in milliseconds
}

// Interface for statistics data
interface StatisticsData {
  processingSpeed: number;
  successRate: number;
  dailyVolume: number;
  queueSize: number;
}

/**
 * Custom hook for managing statistics refresh
 */
const useStatisticsRefresh = (
  interval: number,
  refreshCallback: () => void
) => {
  useEffect(() => {
    if (interval <= 0) return;

    const timer = setInterval(refreshCallback, interval);
    return () => clearInterval(timer);
  }, [interval, refreshCallback]);
};

/**
 * Statistics component displaying key application processing metrics
 * with real-time updates and error handling
 */
const Statistics: React.FC<StatisticsProps> = ({ refreshInterval = 30000 }) => {
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  
  const {
    execute: fetchStatistics,
    loading,
    error
  } = useApi<IApplication[]>({
    method: 'GET',
    url: '/api/v1/applications/statistics'
  });

  /**
   * Calculate statistics from applications data
   */
  const calculateStatistics = useCallback((applications: IApplication[]) => {
    const completed = applications.filter(app => app.status === APPLICATION_STATUS.COMPLETED);
    const failed = applications.filter(app => app.status === APPLICATION_STATUS.FAILED);
    const pending = applications.filter(app => app.status === APPLICATION_STATUS.PENDING);
    
    const totalProcessed = completed.length + failed.length;
    const avgProcessingTime = completed.reduce(
      (acc, app) => acc + (app.metadata.processingDuration || 0),
      0
    ) / (completed.length || 1);

    setStatistics({
      processingSpeed: Number((avgProcessingTime / 60).toFixed(1)), // Convert to minutes
      successRate: Number(((completed.length / (totalProcessed || 1)) * 100).toFixed(1)),
      dailyVolume: totalProcessed,
      queueSize: pending.length
    });
  }, []);

  /**
   * Fetch and update statistics
   */
  const updateStatistics = useCallback(async () => {
    try {
      const data = await fetchStatistics();
      calculateStatistics(data);
    } catch (err) {
      console.error('Failed to fetch statistics:', err);
    }
  }, [fetchStatistics, calculateStatistics]);

  // Initialize statistics and set up refresh interval
  useEffect(() => {
    updateStatistics();
  }, [updateStatistics]);

  useStatisticsRefresh(refreshInterval, updateStatistics);

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load statistics: {error.message}
      </Alert>
    );
  }

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <StatisticsCard elevation={2}>
          <Typography variant="subtitle2" color="textSecondary">
            Processing Speed
          </Typography>
          <MetricValue>
            {statistics?.processingSpeed || 0} min
          </MetricValue>
          {loading && (
            <LoadingOverlay>
              <CircularProgress size={24} />
            </LoadingOverlay>
          )}
        </StatisticsCard>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <StatisticsCard elevation={2}>
          <Typography variant="subtitle2" color="textSecondary">
            Success Rate
          </Typography>
          <MetricValue>
            {statistics?.successRate || 0}%
          </MetricValue>
          {loading && (
            <LoadingOverlay>
              <CircularProgress size={24} />
            </LoadingOverlay>
          )}
        </StatisticsCard>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <StatisticsCard elevation={2}>
          <Typography variant="subtitle2" color="textSecondary">
            Daily Volume
          </Typography>
          <MetricValue>
            {statistics?.dailyVolume || 0}
          </MetricValue>
          {loading && (
            <LoadingOverlay>
              <CircularProgress size={24} />
            </LoadingOverlay>
          )}
        </StatisticsCard>
      </Grid>

      <Grid item xs={12} sm={6} md={3}>
        <StatisticsCard elevation={2}>
          <Typography variant="subtitle2" color="textSecondary">
            Queue Size
          </Typography>
          <MetricValue>
            {statistics?.queueSize || 0}
          </MetricValue>
          {loading && (
            <LoadingOverlay>
              <CircularProgress size={24} />
            </LoadingOverlay>
          )}
        </StatisticsCard>
      </Grid>
    </Grid>
  );
};

export default Statistics;