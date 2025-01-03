/**
 * Core TypeScript interfaces and types shared across backend services
 * Provides type safety and validation support for document processing pipeline
 * @version 1.0.0
 */

import { APPLICATION_STATUS, DOCUMENT_TYPES } from '../constants';

/**
 * Base interface for all document types with immutable core tracking fields
 */
export interface BaseDocument {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Interface for documents that can be processed by the system
 * Extends BaseDocument with processing-specific fields and metadata
 */
export interface ProcessableDocument extends BaseDocument {
  readonly status: APPLICATION_STATUS;
  readonly type: DOCUMENT_TYPES;
  readonly processedAt: Date;
  readonly metadata: Metadata;
}

/**
 * Comprehensive metadata interface for document tracking and processing metrics
 */
export interface Metadata {
  readonly fileSize: number;           // File size in bytes
  readonly mimeType: string;           // MIME type of the document
  readonly pageCount: number;          // Number of pages in document
  readonly processingDuration: number; // Processing time in milliseconds
  readonly ocrConfidence: number;      // OCR confidence score (0-100)
  readonly lastProcessingAttempt: Date;// Timestamp of last processing attempt
}

/**
 * Enhanced validation result interface with detailed error tracking
 */
export interface ValidationResult {
  readonly isValid: boolean;           // Overall validation status
  readonly errors: string[];           // Critical validation errors
  readonly warnings: string[];         // Non-critical validation warnings
  readonly validationTimestamp: Date;  // When validation was performed
}

/**
 * Type guard to check if a document implements ProcessableDocument interface
 * Provides runtime type checking with comprehensive validation
 * @param document - Document to validate
 * @returns boolean indicating if document implements ProcessableDocument
 */
export function isProcessableDocument(document: unknown): document is ProcessableDocument {
  if (!document || typeof document !== 'object') {
    return false;
  }

  const doc = document as ProcessableDocument;

  return (
    // Validate BaseDocument fields
    typeof doc.id === 'string' &&
    doc.createdAt instanceof Date &&
    doc.updatedAt instanceof Date &&
    
    // Validate ProcessableDocument specific fields
    Object.values(APPLICATION_STATUS).includes(doc.status) &&
    Object.values(DOCUMENT_TYPES).includes(doc.type) &&
    doc.processedAt instanceof Date &&
    
    // Validate Metadata object
    typeof doc.metadata === 'object' &&
    typeof doc.metadata.fileSize === 'number' &&
    typeof doc.metadata.mimeType === 'string' &&
    typeof doc.metadata.pageCount === 'number' &&
    typeof doc.metadata.processingDuration === 'number' &&
    typeof doc.metadata.ocrConfidence === 'number' &&
    doc.metadata.lastProcessingAttempt instanceof Date
  );
}