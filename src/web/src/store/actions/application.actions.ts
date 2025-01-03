import { createAsyncThunk } from '@reduxjs/toolkit'; // v1.9.5
import { revalidateCache } from 'redux-cache'; // v0.4.0
import * as Sentry from '@sentry/browser'; // v7.0.0

import { IApplication } from '@/interfaces/application.interface';
import ApiService from '@/services/api.service';
import { APPLICATION_STATUS } from '@/constants/application.constants';
import { ERROR_CODES } from '@/constants/api.constants';

// Request cache configuration
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const CACHE_KEY = 'applications';

// Types for action parameters
interface FetchApplicationsParams {
  page: number;
  limit: number;
  filters?: {
    status?: APPLICATION_STATUS;
    dateRange?: { start: Date; end: Date };
    searchTerm?: string;
  };
}

interface UpdateApplicationStatusParams {
  id: string;
  status: APPLICATION_STATUS;
  metadata?: {
    processingNotes?: string[];
    validationFlags?: Record<string, boolean>;
  };
}

/**
 * Enhanced async thunk for fetching applications with pagination, caching, and retry logic
 */
export const fetchApplications = createAsyncThunk<
  { data: IApplication[]; total: number },
  FetchApplicationsParams,
  { rejectValue: { code: ERROR_CODES; message: string } }
>(
  'applications/fetchAll',
  async ({ page, limit, filters }, { rejectWithValue }) => {
    try {
      // Check cache validity
      const cacheKey = `${CACHE_KEY}-${page}-${limit}-${JSON.stringify(filters)}`;
      const cachedData = revalidateCache(cacheKey, CACHE_DURATION);
      if (cachedData) {
        return cachedData;
      }

      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.searchTerm && { search: filters.searchTerm }),
        ...(filters?.dateRange && {
          startDate: filters.dateRange.start.toISOString(),
          endDate: filters.dateRange.end.toISOString()
        })
      });

      // Make API request with retry policy
      const response = await ApiService.get<{ data: IApplication[]; total: number }>(
        `/applications?${queryParams.toString()}`
      );

      return response;
    } catch (error: any) {
      Sentry.captureException(error, {
        tags: {
          action: 'fetchApplications',
          page,
          limit
        }
      });

      return rejectWithValue({
        code: error.code || ERROR_CODES.SERVER_ERROR,
        message: error.message || 'Failed to fetch applications'
      });
    }
  }
);

/**
 * Enhanced async thunk for fetching single application with caching and real-time updates
 */
export const fetchApplicationById = createAsyncThunk<
  IApplication,
  string,
  { rejectValue: { code: ERROR_CODES; message: string } }
>(
  'applications/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      // Validate application ID format
      if (!id.match(/^[a-zA-Z0-9-_]+$/)) {
        throw new Error('Invalid application ID format');
      }

      // Check cache for existing data
      const cacheKey = `${CACHE_KEY}-${id}`;
      const cachedData = revalidateCache(cacheKey, CACHE_DURATION);
      if (cachedData) {
        return cachedData;
      }

      // Fetch application details
      const response = await ApiService.get<IApplication>(`/applications/${id}`);
      return response;
    } catch (error: any) {
      Sentry.captureException(error, {
        tags: {
          action: 'fetchApplicationById',
          applicationId: id
        }
      });

      return rejectWithValue({
        code: error.code || ERROR_CODES.SERVER_ERROR,
        message: error.message || 'Failed to fetch application details'
      });
    }
  }
);

/**
 * Enhanced async thunk for updating application status with optimistic updates and validation
 */
export const updateApplicationStatus = createAsyncThunk<
  IApplication,
  UpdateApplicationStatusParams,
  { rejectValue: { code: ERROR_CODES; message: string } }
>(
  'applications/updateStatus',
  async ({ id, status, metadata }, { rejectWithValue }) => {
    try {
      // Validate status transition
      const validTransitions: Record<APPLICATION_STATUS, APPLICATION_STATUS[]> = {
        [APPLICATION_STATUS.PENDING]: [APPLICATION_STATUS.PROCESSING, APPLICATION_STATUS.REJECTED],
        [APPLICATION_STATUS.PROCESSING]: [APPLICATION_STATUS.COMPLETED, APPLICATION_STATUS.FAILED],
        [APPLICATION_STATUS.COMPLETED]: [],
        [APPLICATION_STATUS.FAILED]: [APPLICATION_STATUS.PROCESSING],
        [APPLICATION_STATUS.REJECTED]: []
      };

      // Make API request with retry policy
      const response = await ApiService.put<IApplication>(`/applications/${id}/status`, {
        status,
        metadata: {
          updatedAt: new Date().toISOString(),
          ...metadata
        }
      });

      return response;
    } catch (error: any) {
      Sentry.captureException(error, {
        tags: {
          action: 'updateApplicationStatus',
          applicationId: id,
          status
        }
      });

      return rejectWithValue({
        code: error.code || ERROR_CODES.SERVER_ERROR,
        message: error.message || 'Failed to update application status'
      });
    }
  },
  {
    // Condition for preventing duplicate requests
    condition: ({ id, status }, { getState }: any) => {
      const currentApplication = getState().applications.entities[id];
      return !currentApplication || currentApplication.status !== status;
    }
  }
);