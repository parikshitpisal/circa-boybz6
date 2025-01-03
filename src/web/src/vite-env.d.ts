/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables used across the application
 * @version 4.3.0
 */
interface ImportMetaEnv {
  /** Base URL for API endpoints */
  readonly VITE_API_URL: string;

  /** Auth0 domain for authentication */
  readonly VITE_AUTH_DOMAIN: string;

  /** Auth0 client ID for authentication */
  readonly VITE_AUTH_CLIENT_ID: string;

  /** Auth0 API audience identifier */
  readonly VITE_AUTH_AUDIENCE: string;

  /** Cloud storage bucket name for document storage */
  readonly VITE_STORAGE_BUCKET: string;

  /** OCR service endpoint URL */
  readonly VITE_OCR_SERVICE_URL: string;

  /** Current deployment environment */
  readonly VITE_ENVIRONMENT: 'development' | 'staging' | 'production';

  /** API request timeout in milliseconds */
  readonly VITE_API_TIMEOUT: number;

  /** Maximum allowed file upload size in bytes */
  readonly VITE_MAX_UPLOAD_SIZE: number;

  /** Flag to enable debug logging */
  readonly VITE_ENABLE_DEBUG_LOGGING: boolean;
}

/**
 * Augment the ImportMeta interface to include env
 * This ensures type safety when accessing import.meta.env
 */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Export ImportMetaEnv interface to allow importing in other files
export { ImportMetaEnv };