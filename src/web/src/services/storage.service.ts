/**
 * Storage Service
 * Handles secure document storage operations with encryption, validation, and audit logging
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios'; // axios@1.4.0
import CryptoJS from 'crypto-js'; // crypto-js@4.1.1
import { Document } from '../interfaces/document.interface';
import { apiConfig } from '../config/api.config';
import { validateDocumentFile } from '../utils/document.utils';

// Service configuration constants
const UPLOAD_TIMEOUT = 60000;
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIME_TYPES = ['application/pdf'];
const ENCRYPTION_ALGORITHM = 'AES-256-GCM';
const URL_EXPIRATION_TIME = 300000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Upload options interface for document storage
 */
interface UploadOptions {
  onProgress?: (progress: number) => void;
  encryption?: boolean;
  retentionPeriod?: number;
  metadata?: Record<string, any>;
}

/**
 * Download options interface for document retrieval
 */
interface DownloadOptions {
  onProgress?: (progress: number) => void;
  decryption?: boolean;
  validateChecksum?: boolean;
}

/**
 * Preview options interface for document viewing
 */
interface PreviewOptions {
  watermark?: boolean;
  expirationTime?: number;
  accessRestrictions?: string[];
}

/**
 * Delete options interface for document removal
 */
interface DeleteOptions {
  permanent?: boolean;
  auditNote?: string;
}

/**
 * StorageService class for secure document management
 */
export class StorageService {
  private httpClient: AxiosInstance;
  private baseUrl: string;
  private uploadTimeout: number;

  constructor() {
    this.baseUrl = apiConfig.baseURL;
    this.uploadTimeout = UPLOAD_TIMEOUT;
    this.httpClient = axios.create({
      ...apiConfig,
      timeout: this.uploadTimeout,
      maxContentLength: MAX_FILE_SIZE,
      maxBodyLength: MAX_FILE_SIZE,
    });

    this.setupInterceptors();
  }

  /**
   * Configures axios interceptors for request/response handling
   */
  private setupInterceptors(): void {
    this.httpClient.interceptors.request.use(
      (config) => {
        config.headers['X-Request-ID'] = CryptoJS.randomBytes(16).toString('hex');
        config.headers['X-Client-Timestamp'] = new Date().toISOString();
        return config;
      },
      (error) => Promise.reject(error)
    );

    this.httpClient.interceptors.response.use(
      (response) => {
        if (response.headers['x-document-checksum']) {
          this.validateChecksum(response.data, response.headers['x-document-checksum']);
        }
        return response;
      },
      (error) => this.handleRequestError(error)
    );
  }

  /**
   * Uploads document with encryption and validation
   * @param file Document file to upload
   * @param applicationId Associated application ID
   * @param options Upload configuration options
   * @returns Promise resolving to uploaded document details
   */
  public async uploadDocument(
    file: File,
    applicationId: string,
    options: UploadOptions = {}
  ): Promise<Document> {
    try {
      // Validate file
      const validationResult = await validateDocumentFile(file);
      if (!validationResult.isValid) {
        throw new Error(`Invalid document: ${validationResult.errors.join(', ')}`);
      }

      // Prepare encrypted file if encryption is enabled
      const fileData = options.encryption ? 
        await this.encryptFile(file) : 
        await this.prepareFileData(file);

      // Create form data with metadata
      const formData = new FormData();
      formData.append('file', fileData);
      formData.append('applicationId', applicationId);
      formData.append('metadata', JSON.stringify({
        ...options.metadata,
        securityHash: validationResult.metadata.hash,
        uploadTimestamp: new Date().toISOString()
      }));

      // Configure upload request
      const config: AxiosRequestConfig = {
        onUploadProgress: (progressEvent) => {
          if (options.onProgress && progressEvent.total) {
            options.onProgress((progressEvent.loaded / progressEvent.total) * 100);
          }
        },
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Upload-Checksum': validationResult.metadata.hash
        }
      };

      // Perform upload with retry logic
      const response = await this.retryRequest(
        () => this.httpClient.post<Document>('/documents', formData, config)
      );

      return response.data;
    } catch (error) {
      this.logError('Document upload failed', error);
      throw error;
    }
  }

  /**
   * Downloads document with decryption support
   * @param documentId Document identifier
   * @param options Download configuration options
   * @returns Promise resolving to document blob
   */
  public async downloadDocument(
    documentId: string,
    options: DownloadOptions = {}
  ): Promise<Blob> {
    try {
      const config: AxiosRequestConfig = {
        responseType: 'blob',
        onDownloadProgress: (progressEvent) => {
          if (options.onProgress && progressEvent.total) {
            options.onProgress((progressEvent.loaded / progressEvent.total) * 100);
          }
        }
      };

      const response = await this.httpClient.get(
        `/documents/${documentId}/download`,
        config
      );

      const blob = response.data;
      if (options.decryption) {
        return this.decryptBlob(blob);
      }

      return blob;
    } catch (error) {
      this.logError('Document download failed', error);
      throw error;
    }
  }

  /**
   * Generates secure temporary preview URL
   * @param documentId Document identifier
   * @param options Preview configuration options
   * @returns Promise resolving to secure preview URL
   */
  public async getDocumentPreviewUrl(
    documentId: string,
    options: PreviewOptions = {}
  ): Promise<string> {
    try {
      const expirationTime = options.expirationTime || URL_EXPIRATION_TIME;
      const timestamp = new Date().getTime();
      const token = this.generateSecureToken(documentId, timestamp + expirationTime);

      const queryParams = new URLSearchParams({
        token,
        expires: (timestamp + expirationTime).toString(),
        watermark: options.watermark ? '1' : '0'
      });

      if (options.accessRestrictions?.length) {
        queryParams.append('restrictions', options.accessRestrictions.join(','));
      }

      return `${this.baseUrl}/documents/${documentId}/preview?${queryParams.toString()}`;
    } catch (error) {
      this.logError('Preview URL generation failed', error);
      throw error;
    }
  }

  /**
   * Deletes document with audit logging
   * @param documentId Document identifier
   * @param options Delete configuration options
   */
  public async deleteDocument(
    documentId: string,
    options: DeleteOptions = {}
  ): Promise<void> {
    try {
      await this.httpClient.delete(`/documents/${documentId}`, {
        data: {
          permanent: options.permanent || false,
          auditNote: options.auditNote
        }
      });
    } catch (error) {
      this.logError('Document deletion failed', error);
      throw error;
    }
  }

  /**
   * Encrypts file data using AES-256-GCM
   * @param file File to encrypt
   * @returns Promise resolving to encrypted blob
   */
  private async encryptFile(file: File): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const key = await this.getEncryptionKey();
          const iv = CryptoJS.lib.WordArray.random(12);
          const encrypted = CryptoJS.AES.encrypt(
            e.target?.result as string,
            key,
            {
              iv,
              mode: CryptoJS.mode.GCM,
              padding: CryptoJS.pad.Pkcs7
            }
          );

          const blob = new Blob(
            [iv.toString(), encrypted.toString()],
            { type: 'application/octet-stream' }
          );
          resolve(blob);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Decrypts blob data
   * @param blob Encrypted blob
   * @returns Promise resolving to decrypted blob
   */
  private async decryptBlob(blob: Blob): Promise<Blob> {
    const arrayBuffer = await blob.arrayBuffer();
    const key = await this.getEncryptionKey();
    const decrypted = CryptoJS.AES.decrypt(
      arrayBuffer.toString(),
      key,
      {
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.Pkcs7
      }
    );

    return new Blob([decrypted.toString(CryptoJS.enc.Utf8)]);
  }

  /**
   * Retrieves encryption key from secure storage
   * @returns Promise resolving to encryption key
   */
  private async getEncryptionKey(): Promise<CryptoJS.lib.WordArray> {
    // Implementation would integrate with key management service
    return CryptoJS.SHA256(process.env.DOCUMENT_ENCRYPTION_KEY || '');
  }

  /**
   * Generates secure token for document access
   * @param documentId Document identifier
   * @param expirationTime Token expiration timestamp
   * @returns Secure access token
   */
  private generateSecureToken(documentId: string, expirationTime: number): string {
    return CryptoJS.HmacSHA256(
      `${documentId}:${expirationTime}`,
      process.env.DOCUMENT_SECRET_KEY || ''
    ).toString();
  }

  /**
   * Validates document checksum
   * @param data Document data
   * @param expectedChecksum Expected checksum value
   */
  private validateChecksum(data: any, expectedChecksum: string): void {
    const calculatedChecksum = CryptoJS.SHA256(JSON.stringify(data)).toString();
    if (calculatedChecksum !== expectedChecksum) {
      throw new Error('Document checksum validation failed');
    }
  }

  /**
   * Implements retry logic for requests
   * @param request Request function to retry
   * @returns Promise resolving to request response
   */
  private async retryRequest<T>(request: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        return await request();
      } catch (error) {
        lastError = error as Error;
        if (attempt === MAX_RETRY_ATTEMPTS) break;
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    throw lastError;
  }

  /**
   * Logs error with context
   * @param message Error message
   * @param error Error object
   */
  private logError(message: string, error: any): void {
    console.error({
      message,
      error,
      timestamp: new Date().toISOString(),
      service: 'StorageService'
    });
  }
}