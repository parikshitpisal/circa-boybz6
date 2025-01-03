/**
 * Document handling interfaces for API Gateway service
 * Provides comprehensive type definitions for document processing pipeline
 * @version 1.0.0
 */

import { BaseDocument, ProcessableDocument } from '../../../shared/interfaces/common';

/**
 * Enhanced metadata interface for document processing with comprehensive tracking capabilities
 */
export interface DocumentMetadata {
  fileSize: number;                           // Size of document in bytes
  mimeType: string;                           // Document MIME type
  pageCount: number;                          // Total number of pages
  processingDuration: number;                 // Processing time in milliseconds
  extractedData: Record<string, any>;         // Structured data extracted from document
  validationErrors: string[];                 // List of validation error messages
  processingEngine: string;                   // OCR/Processing engine used
  processingAttempts: number;                 // Number of processing attempts
  confidenceScores: Record<string, number>;   // Field-level confidence scores
  processingSteps: string[];                  // List of completed processing steps
  validationRules: Record<string, string>;    // Applied validation rules
}

/**
 * Main document interface for API Gateway service
 * Extends BaseDocument and ProcessableDocument with enhanced tracking and metadata
 */
export interface Document extends BaseDocument, ProcessableDocument {
  applicationId: string;                      // Associated application ID
  storagePath: string;                        // Document storage location
  ocrConfidence: number;                      // Overall OCR confidence score
  metadata: DocumentMetadata;                 // Enhanced document metadata
  sourceEmail: string;                        // Source email address
  originalFilename: string;                   // Original uploaded filename
  processingPriority: string;                 // Processing priority level
  tags: string[];                            // Document classification tags
}

/**
 * Enhanced interface for document API responses
 * Extends Document with secure access URLs and preview capabilities
 */
export interface DocumentResponse extends Document {
  downloadUrl: string;                        // Secure temporary download URL
  previewUrl: string;                         // Secure document preview URL
  urlExpiryTime: number;                      // URL expiration timestamp
  isPreviewAvailable: boolean;                // Preview generation status
  thumbnailUrl: string;                       // Document thumbnail URL
  alternateFormats: Record<string, string>;   // URLs for alternate formats
}