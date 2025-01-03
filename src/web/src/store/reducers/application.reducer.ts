/**
 * Application Reducer
 * Redux reducer for managing merchant cash advance application state
 * Optimized for high-volume processing with real-time updates
 * @version 1.0.0
 */

import { createSlice, createEntityAdapter, PayloadAction } from '@reduxjs/toolkit';
import { IApplication } from '../../interfaces/application.interface';
import { APPLICATION_STATUS } from '../../constants/application.constants';

/**
 * Performance metrics interface for tracking reducer operations
 */
interface PerformanceMetrics {
  lastUpdate: string | null;
  updateCount: number;
  errorCount: number;
  processingDuration: number;
}

/**
 * Pagination metadata interface
 */
interface PaginationMetadata {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * Filter criteria interface for application filtering
 */
interface FilterCriteria {
  status: APPLICATION_STATUS | null;
  dateRange: { start: string; end: string } | null;
  searchTerm: string | null;
}

/**
 * Enhanced application state interface with performance optimizations
 */
interface IApplicationState {
  entities: Record<string, IApplication>;
  ids: string[];
  selectedApplication: IApplication | null;
  loading: boolean;
  error: string | null;
  pagination: PaginationMetadata;
  filters: FilterCriteria;
  metrics: PerformanceMetrics;
}

// Create entity adapter for normalized state management
const applicationAdapter = createEntityAdapter<IApplication>({
  selectId: (application) => application.id,
  sortComparer: (a, b) => b.createdAt.localeCompare(a.createdAt)
});

// Initialize state with performance optimizations
const initialState: IApplicationState = {
  ...applicationAdapter.getInitialState(),
  selectedApplication: null,
  loading: false,
  error: null,
  pagination: {
    currentPage: 1,
    pageSize: 50,
    totalCount: 0,
    totalPages: 0
  },
  filters: {
    status: null,
    dateRange: null,
    searchTerm: null
  },
  metrics: {
    lastUpdate: null,
    updateCount: 0,
    errorCount: 0,
    processingDuration: 0
  }
};

// Create the application slice with optimized reducers
const applicationSlice = createSlice({
  name: 'application',
  initialState,
  reducers: {
    // Set loading state with performance tracking
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
      if (action.payload) {
        state.metrics.lastUpdate = new Date().toISOString();
      }
    },

    // Handle batch updates efficiently
    addApplications: (state, action: PayloadAction<IApplication[]>) => {
      applicationAdapter.upsertMany(state, action.payload);
      state.metrics.updateCount += action.payload.length;
      state.metrics.lastUpdate = new Date().toISOString();
    },

    // Update single application with optimistic updates
    updateApplication: (state, action: PayloadAction<IApplication>) => {
      applicationAdapter.updateOne(state, {
        id: action.payload.id,
        changes: action.payload
      });
      state.metrics.updateCount++;
      state.metrics.lastUpdate = new Date().toISOString();
    },

    // Handle real-time status updates
    updateApplicationStatus: (
      state,
      action: PayloadAction<{ id: string; status: APPLICATION_STATUS }>
    ) => {
      applicationAdapter.updateOne(state, {
        id: action.payload.id,
        changes: { status: action.payload.status }
      });
    },

    // Set selected application with cache management
    setSelectedApplication: (state, action: PayloadAction<string | null>) => {
      state.selectedApplication = action.payload
        ? state.entities[action.payload]
        : null;
    },

    // Update pagination with performance optimization
    setPagination: (state, action: PayloadAction<Partial<PaginationMetadata>>) => {
      state.pagination = { ...state.pagination, ...action.payload };
    },

    // Update filters with memoization support
    setFilters: (state, action: PayloadAction<Partial<FilterCriteria>>) => {
      state.filters = { ...state.filters, ...action.payload };
      state.pagination.currentPage = 1; // Reset pagination on filter change
    },

    // Handle errors with metrics tracking
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      if (action.payload) {
        state.metrics.errorCount++;
      }
    },

    // Clear state for cleanup
    clearState: (state) => {
      return { ...initialState };
    }
  }
});

// Export actions and selectors
export const {
  setLoading,
  addApplications,
  updateApplication,
  updateApplicationStatus,
  setSelectedApplication,
  setPagination,
  setFilters,
  setError,
  clearState
} = applicationSlice.actions;

// Create memoized selectors
export const {
  selectAll: selectAllApplications,
  selectById: selectApplicationById,
  selectIds: selectApplicationIds,
  selectTotal: selectTotalApplications
} = applicationAdapter.getSelectors();

// Export reducer
export default applicationSlice.reducer;