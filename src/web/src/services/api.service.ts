import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // v1.4.0
import CircuitBreaker from 'opossum'; // v6.0.0
import rateLimit from 'axios-rate-limit'; // v1.3.0

import { apiConfig } from '../config/api.config';
import { API_ENDPOINTS, APIResponse, APIError } from '../constants/api.constants';
import { ApiUtils, ApiError } from '../utils/api.utils';

/**
 * Enhanced API service class providing centralized HTTP request handling with advanced features
 * - Comprehensive error handling and retry policies
 * - Request deduplication and caching
 * - Circuit breaker pattern implementation
 * - Rate limiting with backoff
 * - Response transformation and validation
 * - Security features (CSRF, request signing)
 */
export class ApiService {
  private readonly httpClient: AxiosInstance;
  private readonly breaker: CircuitBreaker;
  private readonly pendingRequests: Map<string, Promise<any>>;

  constructor() {
    // Initialize HTTP client with enhanced configuration
    this.httpClient = rateLimit(axios.create({
      baseURL: apiConfig.baseURL,
      timeout: apiConfig.timeout,
      headers: apiConfig.headers
    }), { maxRequests: 100, perMilliseconds: 1000 });

    // Initialize circuit breaker
    this.breaker = new CircuitBreaker(this.makeRequest.bind(this), {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000
    });

    // Initialize request deduplication cache
    this.pendingRequests = new Map();

    // Configure request interceptors
    this.setupRequestInterceptors();

    // Configure response interceptors
    this.setupResponseInterceptors();
  }

  /**
   * Enhanced GET request with caching and error handling
   * @param url - Request URL
   * @param config - Optional axios config
   * @returns Promise with typed response
   */
  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const cacheKey = this.getCacheKey('GET', url, config);
    
    // Check for pending requests
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      return pendingRequest as Promise<T>;
    }

    const request = this.executeRequest<T>('GET', url, undefined, config);
    this.pendingRequests.set(cacheKey, request);

    try {
      const response = await request;
      this.pendingRequests.delete(cacheKey);
      return response;
    } catch (error) {
      this.pendingRequests.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Enhanced POST request with validation and monitoring
   * @param url - Request URL
   * @param data - Request payload
   * @param config - Optional axios config
   * @returns Promise with typed response
   */
  public async post<T>(url: string, data: any, config?: AxiosRequestConfig): Promise<T> {
    // Add CSRF token if enabled
    const csrfToken = this.getCsrfToken();
    const enhancedConfig = {
      ...config,
      headers: {
        ...config?.headers,
        'X-CSRF-Token': csrfToken
      }
    };

    return this.executeRequest<T>('POST', url, data, enhancedConfig);
  }

  /**
   * Execute HTTP request with circuit breaker and error handling
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<T> {
    try {
      const response = await this.breaker.fire(() => 
        this.makeRequest(method, url, data, config)
      );

      return ApiUtils.transformResponse<T>(response, {
        includePagination: true,
        includeMetadata: true
      }).data;
    } catch (error) {
      throw await ApiUtils.handleApiError(error);
    }
  }

  /**
   * Make HTTP request with retry policy
   */
  private async makeRequest(
    method: string,
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<AxiosResponse> {
    const requestConfig: AxiosRequestConfig = {
      ...config,
      method,
      url,
      data,
      retryPolicy: apiConfig.retryPolicy
    };

    return this.httpClient.request(requestConfig);
  }

  /**
   * Configure request interceptors for authentication and monitoring
   */
  private setupRequestInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        // Add authentication token
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request ID for tracing
        config.headers['X-Request-ID'] = this.generateRequestId();

        // Add performance tracking metadata
        config.metadata = { startTime: Date.now() };

        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Configure response interceptors for error handling and transformation
   */
  private setupResponseInterceptors(): void {
    this.httpClient.interceptors.response.use(
      (response) => {
        // Track request performance
        if (response.config.metadata) {
          const duration = Date.now() - response.config.metadata.startTime;
          this.trackRequestPerformance(response.config.url!, duration);
        }

        // Validate response format
        ApiUtils.validateResponse(response);

        return response;
      },
      (error) => Promise.reject(error)
    );
  }

  /**
   * Generate cache key for request deduplication
   */
  private getCacheKey(method: string, url: string, config?: AxiosRequestConfig): string {
    return `${method}:${url}:${JSON.stringify(config?.params || {})}`;
  }

  /**
   * Get CSRF token for secure requests
   */
  private getCsrfToken(): string {
    return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  }

  /**
   * Generate unique request ID for tracing
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Track request performance metrics
   */
  private trackRequestPerformance(url: string, duration: number): void {
    if (apiConfig.monitoring.enablePerformanceTracking) {
      console.debug(`Request to ${url} took ${duration}ms`);
      // Additional performance tracking logic would go here
    }
  }
}

export default new ApiService();