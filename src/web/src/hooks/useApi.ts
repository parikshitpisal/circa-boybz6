import { useState, useCallback, useRef, useEffect } from 'react'; // ^18.0.0
import { get, post, put, delete as httpDelete, retryRequest, cancelRequest } from '../services/api.service';
import { ApiError, ApiResponse } from '../utils/api.utils';

/**
 * Interface for pagination metadata
 */
interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
}

/**
 * Enhanced state interface for the useApi hook
 */
interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  requestId: string | null;
  retryCount: number;
  lastRequestTime: number | null;
  pagination: PaginationMetadata | null;
  validationErrors: Record<string, string[]> | null;
}

/**
 * Interface for retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  backoffFactor: number;
  retryCondition: (error: ApiError) => boolean;
}

/**
 * Interface for request configuration
 */
interface RequestConfig<T> {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  data?: any;
  retryConfig?: RetryConfig;
  transformResponse?: (response: any) => T;
  cancelToken?: AbortController;
}

/**
 * Enhanced return interface for the useApi hook
 */
interface UseApiResponse<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  execute: () => Promise<void>;
  reset: () => void;
  cancel: () => void;
  retry: () => Promise<void>;
  pagination: PaginationMetadata | null;
  validationErrors: Record<string, string[]> | null;
}

/**
 * Enhanced custom hook for making API requests with advanced features
 * @param config Request configuration object
 * @returns Enhanced API request state and control functions
 */
export function useApi<T>(config: RequestConfig<T>): UseApiResponse<T> {
  // Initialize state with enhanced metadata
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: false,
    error: null,
    requestId: null,
    retryCount: 0,
    lastRequestTime: null,
    pagination: null,
    validationErrors: null
  });

  // Reference for request cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Track mounted state to prevent updates after unmount
  const mountedRef = useRef<boolean>(true);

  // Request deduplication cache
  const requestCacheRef = useRef<Map<string, Promise<ApiResponse<T>>>>(new Map());

  /**
   * Execute API request with enhanced error handling and retries
   */
  const execute = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = config.cancelToken || new AbortController();

    // Generate request cache key
    const cacheKey = `${config.method}:${config.url}:${JSON.stringify(config.data)}`;

    try {
      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
        requestId: `req_${Date.now()}`,
        lastRequestTime: Date.now()
      }));

      // Check request cache for deduplication
      let responsePromise = requestCacheRef.current.get(cacheKey);
      
      if (!responsePromise) {
        responsePromise = (async () => {
          try {
            let response: ApiResponse<T>;

            switch (config.method) {
              case 'GET':
                response = await get(config.url);
                break;
              case 'POST':
                response = await post(config.url, config.data);
                break;
              case 'PUT':
                response = await put(config.url, config.data);
                break;
              case 'DELETE':
                response = await httpDelete(config.url);
                break;
              default:
                throw new Error(`Unsupported method: ${config.method}`);
            }

            // Transform response if needed
            const transformedData = config.transformResponse 
              ? config.transformResponse(response.data)
              : response.data;

            return {
              ...response,
              data: transformedData
            };
          } finally {
            // Clean up cache entry
            requestCacheRef.current.delete(cacheKey);
          }
        })();

        requestCacheRef.current.set(cacheKey, responsePromise);
      }

      const response = await responsePromise;

      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          data: response.data,
          loading: false,
          error: null,
          pagination: response.pagination,
          validationErrors: null
        }));
      }
    } catch (error) {
      if (!mountedRef.current) return;

      const apiError = error as ApiError;
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: apiError,
        validationErrors: apiError.validationErrors?.reduce((acc, curr) => ({
          ...acc,
          [curr.field]: [curr.message]
        }), {})
      }));

      // Handle automatic retry if configured
      if (config.retryConfig && state.retryCount < config.retryConfig.maxRetries) {
        if (config.retryConfig.retryCondition(apiError)) {
          const backoffTime = config.retryConfig.backoffFactor * Math.pow(2, state.retryCount);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          if (mountedRef.current) {
            setState(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
            await retryRequest(config.url, config.method, config.data);
          }
        }
      }
    }
  }, [config, state.retryCount]);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      requestId: null,
      retryCount: 0,
      lastRequestTime: null,
      pagination: null,
      validationErrors: null
    });
  }, []);

  /**
   * Cancel ongoing request
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      cancelRequest(config.url);
    }
  }, [config.url]);

  /**
   * Retry failed request
   */
  const retry = useCallback(async () => {
    setState(prev => ({
      ...prev,
      error: null,
      retryCount: prev.retryCount + 1
    }));
    await execute();
  }, [execute]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cancel();
      requestCacheRef.current.clear();
    };
  }, [cancel]);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    execute,
    reset,
    cancel,
    retry,
    pagination: state.pagination,
    validationErrors: state.validationErrors
  };
}

export default useApi;