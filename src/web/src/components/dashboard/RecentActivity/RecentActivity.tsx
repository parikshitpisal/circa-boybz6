import React, { memo, useMemo, useCallback } from 'react';
import { Typography, IconButton, Tooltip, Chip } from '@mui/material'; // ^5.0.0
import { Visibility, Edit } from '@mui/icons-material'; // ^5.0.0
import { formatDistanceToNow } from 'date-fns'; // ^2.30.0

import Card from '../../common/Card/Card';
import Table from '../../common/Table/Table';
import { IApplication } from '../../../interfaces/application.interface';
import { APPLICATION_STATUS, APPLICATION_STATUS_LABELS, STATUS_COLORS } from '../../../constants/application.constants';

// Constants for accessibility and testing
const TEST_ID = 'recent-activity-component';
const ARIA_LABELS = {
  card: 'Recent Applications Activity',
  viewButton: 'View application details',
  editButton: 'Edit application',
  timeAgo: 'Time since application',
  status: 'Application status'
};

// Interface for component props
interface RecentActivityProps {
  applications: IApplication[];
  loading?: boolean;
  onViewApplication: (id: string) => void;
  onEditApplication: (id: string) => void;
  error?: Error | null;
}

/**
 * Formats application data for table display with memoization
 */
const useFormattedTableData = (applications: IApplication[]) => {
  return useMemo(() => {
    return applications.map(app => ({
      id: app.id,
      businessName: app.merchantData.businessName,
      status: app.status,
      timeAgo: formatDistanceToNow(new Date(app.createdAt), { addSuffix: true }),
      raw: app // Preserve raw data for reference
    }));
  }, [applications]);
};

/**
 * Table column definitions with accessibility enhancements
 */
const useTableColumns = (
  onViewApplication: (id: string) => void,
  onEditApplication: (id: string) => void
) => {
  return useMemo(() => [
    {
      field: 'businessName',
      headerName: 'Business Name',
      flex: 1,
      renderCell: (params: any) => (
        <Typography variant="body2" noWrap>
          {params.value}
        </Typography>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      renderCell: (params: any) => (
        <Chip
          label={APPLICATION_STATUS_LABELS[params.value as APPLICATION_STATUS]}
          size="small"
          sx={{
            backgroundColor: STATUS_COLORS[params.value as APPLICATION_STATUS],
            color: '#FFFFFF',
            fontWeight: 'medium'
          }}
          aria-label={`${ARIA_LABELS.status}: ${APPLICATION_STATUS_LABELS[params.value as APPLICATION_STATUS]}`}
        />
      )
    },
    {
      field: 'timeAgo',
      headerName: 'Time',
      width: 120,
      renderCell: (params: any) => (
        <Tooltip title={new Date(params.row.raw.createdAt).toLocaleString()}>
          <Typography
            variant="body2"
            color="textSecondary"
            aria-label={`${ARIA_LABELS.timeAgo}: ${params.value}`}
          >
            {params.value}
          </Typography>
        </Tooltip>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params: any) => (
        <div>
          <Tooltip title={ARIA_LABELS.viewButton}>
            <IconButton
              size="small"
              onClick={() => onViewApplication(params.row.id)}
              aria-label={ARIA_LABELS.viewButton}
            >
              <Visibility fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={ARIA_LABELS.editButton}>
            <IconButton
              size="small"
              onClick={() => onEditApplication(params.row.id)}
              aria-label={ARIA_LABELS.editButton}
            >
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      )
    }
  ], [onViewApplication, onEditApplication]);
};

/**
 * RecentActivity component displays recent merchant cash advance applications
 * with real-time updates and accessibility features
 */
export const RecentActivity = memo<RecentActivityProps>(({
  applications,
  loading = false,
  onViewApplication,
  onEditApplication,
  error
}) => {
  // Memoized handlers for performance
  const handleViewApplication = useCallback((id: string) => {
    onViewApplication(id);
  }, [onViewApplication]);

  const handleEditApplication = useCallback((id: string) => {
    onEditApplication(id);
  }, [onEditApplication]);

  // Memoized data transformations
  const tableData = useFormattedTableData(applications);
  const columns = useTableColumns(handleViewApplication, handleEditApplication);

  return (
    <Card
      elevation={1}
      role="region"
      aria-label={ARIA_LABELS.card}
      data-testid={TEST_ID}
    >
      <Typography
        variant="h6"
        component="h2"
        sx={{ p: 2, pb: 1 }}
        fontWeight="medium"
      >
        Recent Applications
      </Typography>

      <Table
        columns={columns}
        data={tableData}
        loading={loading}
        pageSize={10}
        statusColumn="status"
        ariaLabel="Recent applications table"
      />

      {error && (
        <Typography
          color="error"
          variant="body2"
          sx={{ p: 2 }}
          role="alert"
        >
          {error.message}
        </Typography>
      )}
    </Card>
  );
});

RecentActivity.displayName = 'RecentActivity';

export default RecentActivity;