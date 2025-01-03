import React, { useMemo, useCallback } from 'react';
import { Box, Typography, LinearProgress, Tooltip, useTheme } from '@mui/material'; // ^5.0.0
import Card from '../../common/Card/Card';
import Loading from '../../common/Loading/Loading';
import { IApplication } from '../../../interfaces/application.interface';
import { APPLICATION_STATUS, STATUS_COLORS } from '../../../constants/application.constants';

/**
 * Props interface for ProcessingStatus component
 */
interface ProcessingStatusProps {
  applications: IApplication[];
  loading?: boolean;
  className?: string;
  onError?: (error: Error) => void;
}

/**
 * Interface for calculated processing metrics
 */
interface ProcessingMetrics {
  averageProcessingTime: number;
  successRate: number;
  totalProcessed: number;
  queueSize: number;
  lastUpdated: Date;
}

/**
 * Calculates processing metrics from application data
 * @param applications - Array of applications to analyze
 * @returns ProcessingMetrics object with calculated values
 */
const calculateMetrics = (applications: IApplication[]): ProcessingMetrics => {
  try {
    const now = new Date();
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Filter recent applications
    const recentApplications = applications.filter(app => 
      new Date(app.updatedAt) >= last24Hours
    );

    // Calculate processing times for completed applications
    const completedApplications = recentApplications.filter(app => 
      app.status === APPLICATION_STATUS.COMPLETED
    );

    const processingTimes = completedApplications.map(app => 
      app.metadata.processingDuration
    );

    // Calculate average processing time (in seconds)
    const averageProcessingTime = processingTimes.length > 0
      ? processingTimes.reduce((acc, time) => acc + time, 0) / processingTimes.length
      : 0;

    // Calculate success rate
    const totalAttempted = recentApplications.filter(app =>
      app.status === APPLICATION_STATUS.COMPLETED || app.status === APPLICATION_STATUS.FAILED
    ).length;

    const successRate = totalAttempted > 0
      ? (completedApplications.length / totalAttempted) * 100
      : 0;

    // Calculate queue metrics
    const queueSize = applications.filter(app =>
      app.status === APPLICATION_STATUS.PENDING || app.status === APPLICATION_STATUS.PROCESSING
    ).length;

    return {
      averageProcessingTime,
      successRate,
      totalProcessed: completedApplications.length,
      queueSize,
      lastUpdated: now
    };
  } catch (error) {
    throw new Error(`Failed to calculate metrics: ${error.message}`);
  }
};

/**
 * ProcessingStatus component displays real-time processing metrics
 * for merchant cash advance applications
 */
const ProcessingStatus: React.FC<ProcessingStatusProps> = ({
  applications,
  loading = false,
  className,
  onError
}) => {
  const theme = useTheme();

  // Calculate metrics with error handling
  const metrics = useMemo(() => {
    try {
      return calculateMetrics(applications);
    } catch (error) {
      onError?.(error);
      return null;
    }
  }, [applications, onError]);

  // Format processing time for display
  const formatProcessingTime = useCallback((seconds: number): string => {
    return seconds < 60
      ? `${seconds.toFixed(1)}s`
      : `${(seconds / 60).toFixed(1)}m`;
  }, []);

  if (loading) {
    return <Loading size="medium" text="Loading processing metrics..." />;
  }

  if (!metrics) {
    return (
      <Card elevation={1} className={className}>
        <Box p={2}>
          <Typography color="error" role="alert">
            Unable to calculate processing metrics
          </Typography>
        </Box>
      </Card>
    );
  }

  return (
    <Card 
      elevation={1} 
      className={className}
      role="region"
      aria-label="Application Processing Metrics"
    >
      <Box p={2} display="flex" flexDirection="column" gap={2}>
        {/* Processing Speed Section */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Processing Speed
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <LinearProgress
              variant="determinate"
              value={Math.min((300 / metrics.averageProcessingTime) * 100, 100)}
              sx={{
                flexGrow: 1,
                backgroundColor: theme.palette.grey[200],
                '& .MuiLinearProgress-bar': {
                  backgroundColor: STATUS_COLORS[APPLICATION_STATUS.PROCESSING]
                }
              }}
              aria-label="Processing speed indicator"
            />
            <Tooltip title="Average processing time per application">
              <Typography variant="body2" color="textSecondary">
                {formatProcessingTime(metrics.averageProcessingTime)}
              </Typography>
            </Tooltip>
          </Box>
        </Box>

        {/* Success Rate Section */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Success Rate
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <LinearProgress
              variant="determinate"
              value={metrics.successRate}
              sx={{
                flexGrow: 1,
                backgroundColor: theme.palette.grey[200],
                '& .MuiLinearProgress-bar': {
                  backgroundColor: STATUS_COLORS[APPLICATION_STATUS.COMPLETED]
                }
              }}
              aria-label="Success rate indicator"
            />
            <Tooltip title="Percentage of successfully processed applications">
              <Typography variant="body2" color="textSecondary">
                {metrics.successRate.toFixed(1)}%
              </Typography>
            </Tooltip>
          </Box>
        </Box>

        {/* Queue Statistics */}
        <Box display="flex" justifyContent="space-between" mt={1}>
          <Tooltip title="Applications processed in the last 24 hours">
            <Box>
              <Typography variant="body2" color="textSecondary">
                Processed Today
              </Typography>
              <Typography variant="h6">
                {metrics.totalProcessed}
              </Typography>
            </Box>
          </Tooltip>
          <Tooltip title="Applications currently in queue">
            <Box textAlign="right">
              <Typography variant="body2" color="textSecondary">
                In Queue
              </Typography>
              <Typography variant="h6">
                {metrics.queueSize}
              </Typography>
            </Box>
          </Tooltip>
        </Box>

        {/* Last Updated Timestamp */}
        <Typography 
          variant="caption" 
          color="textSecondary" 
          sx={{ alignSelf: 'flex-end' }}
        >
          Last updated: {metrics.lastUpdated.toLocaleTimeString()}
        </Typography>
      </Box>
    </Card>
  );
};

export default ProcessingStatus;