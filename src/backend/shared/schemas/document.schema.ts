/**
 * Document schema definition using Zod for runtime validation
 * Implements comprehensive validation rules for document processing pipeline
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { BaseDocument } from '../interfaces/common';
import { DOCUMENT_TYPES, APPLICATION_STATUS } from '../constants';

/**
 * Metadata schema with strict validation rules for document processing metrics
 */
const MetadataSchema = z.object({
  fileSize: z.number()
    .positive('File size must be greater than 0')
    .int('File size must be an integer')
    .describe('Size of document in bytes'),

  mimeType: z.string()
    .regex(/^application\/pdf$/, 'Only PDF documents are supported')
    .describe('MIME type of the document'),

  pageCount: z.number()
    .int('Page count must be an integer')
    .min(1, 'Document must have at least one page')
    .max(1000, 'Document exceeds maximum page limit')
    .describe('Number of pages in document'),

  processingDuration: z.number()
    .nonnegative('Processing duration cannot be negative')
    .optional()
    .describe('Processing time in milliseconds'),

  extractedData: z.record(z.unknown())
    .optional()
    .describe('Structured data extracted from document'),

  validationErrors: z.array(z.string())
    .optional()
    .describe('List of validation errors encountered'),

  processingAttempts: z.number()
    .int('Processing attempts must be an integer')
    .min(0, 'Processing attempts cannot be negative')
    .max(3, 'Maximum processing attempts exceeded')
    .optional()
    .describe('Number of processing attempts'),

  lastError: z.string()
    .max(1000, 'Error message too long')
    .optional()
    .describe('Last error message encountered')
});

/**
 * Comprehensive document schema with enhanced validation rules
 * Extends BaseDocument interface with processing-specific fields
 */
export const DocumentSchema = z.object({
  // Base document fields
  id: z.string()
    .uuid('Invalid document ID format')
    .describe('Unique identifier for document'),

  applicationId: z.string()
    .uuid('Invalid application ID format')
    .describe('Associated application identifier'),

  // Document-specific fields
  type: z.nativeEnum(DOCUMENT_TYPES)
    .describe('Type of document being processed'),

  status: z.nativeEnum(APPLICATION_STATUS)
    .describe('Current processing status'),

  storagePath: z.string()
    .regex(/^s3:\/\/[\w-]+\/.+$/, 'Invalid storage path format')
    .describe('S3 storage location'),

  ocrConfidence: z.number()
    .min(0, 'OCR confidence cannot be negative')
    .max(100, 'OCR confidence cannot exceed 100')
    .multipleOf(0.01, 'OCR confidence must have 2 decimal precision')
    .optional()
    .describe('OCR confidence score'),

  metadata: MetadataSchema
    .describe('Document processing metadata'),

  // Timestamp fields
  createdAt: z.date()
    .describe('Document creation timestamp'),

  updatedAt: z.date()
    .describe('Last update timestamp'),

  processedAt: z.date()
    .optional()
    .describe('Processing completion timestamp')
}).strict();

/**
 * TypeScript type inference from Zod schema
 */
export type DocumentType = z.infer<typeof DocumentSchema>;

/**
 * Validates document data against schema with enhanced error reporting
 * @param documentData - Document data to validate
 * @returns Promise resolving to validation result
 */
export async function validateDocument(documentData: unknown): Promise<boolean> {
  try {
    await DocumentSchema.parseAsync(documentData);
    return true;
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Enhanced error handling with detailed validation failures
      const validationErrors = error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      console.error('Document validation failed:', validationErrors);
    }
    return false;
  }
}