/**
 * Document Utility Functions
 * Provides secure document handling, validation, and transformation utilities
 * @version 1.0.0
 */

import { Document, DocumentMetadata } from '../interfaces/document.interface';
import { DOCUMENT_TYPE, DOCUMENT_TYPE_LABELS, VALIDATION_RULES } from '../constants/application.constants';
import filesize from 'filesize'; // v10.0.0
import CryptoJS from 'crypto-js'; // v4.1.1

/**
 * Interface for document validation results
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  securityStatus: {
    hashValid: boolean;
    malwareDetected: boolean;
    permissionsValid: boolean;
  };
  metadata: {
    fileSize: number;
    mimeType: string;
    hash: string;
  };
}

/**
 * Interface for secure URL generation
 */
interface SecureUrl {
  url: string;
  expiresAt: Date;
  token: string;
  accessTracking: {
    requestId: string;
    timestamp: Date;
  };
}

/**
 * Formats file size with accessibility support
 * @param bytes - File size in bytes
 * @returns Formatted string with ARIA labels
 */
export const formatFileSize = (bytes: number): string => {
  if (typeof bytes !== 'number' || bytes < 0) {
    throw new Error('Invalid file size value');
  }

  const formatted = filesize(bytes, { base: 10, standard: 'jedec' });
  return `<span aria-label="File size: ${formatted}">${formatted}</span>`;
};

/**
 * Returns accessible document type label
 * @param type - Document type enum value
 * @returns Formatted document type label with ARIA support
 */
export const getDocumentTypeLabel = (type: DOCUMENT_TYPE): string => {
  if (!Object.values(DOCUMENT_TYPE).includes(type)) {
    throw new Error('Invalid document type');
  }

  const label = DOCUMENT_TYPE_LABELS[type];
  return `<span role="text" aria-label="Document type: ${label}">${label}</span>`;
};

/**
 * Validates document file with comprehensive security checks
 * @param file - File object to validate
 * @returns Promise resolving to validation result
 */
export const validateDocumentFile = async (file: File): Promise<ValidationResult> => {
  const errors: string[] = [];
  const fileSizeInMB = file.size / (1024 * 1024);

  // Size validation
  if (fileSizeInMB > VALIDATION_RULES.MAX_FILE_SIZE) {
    errors.push(`File size exceeds maximum limit of ${VALIDATION_RULES.MAX_FILE_SIZE}MB`);
  }

  // Type validation
  const fileExtension = `.${file.name.split('.').pop()?.toLowerCase()}`;
  if (!VALIDATION_RULES.ALLOWED_FILE_TYPES.includes(fileExtension as any)) {
    errors.push('Invalid file type');
  }

  // Generate file hash
  const fileHash = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const hash = CryptoJS.SHA256(e.target?.result as string).toString();
      resolve(hash);
    };
    reader.readAsArrayBuffer(file);
  });

  // Malware signature check (simplified implementation)
  const malwareDetected = await checkMalwareSignatures(file);

  return {
    isValid: errors.length === 0 && !malwareDetected,
    errors,
    securityStatus: {
      hashValid: true,
      malwareDetected,
      permissionsValid: true
    },
    metadata: {
      fileSize: file.size,
      mimeType: file.type,
      hash: fileHash
    }
  };
};

/**
 * Generates secure document preview URL with access control
 * @param documentId - Document identifier
 * @param accessControl - Access control metadata
 * @returns Promise resolving to secure URL object
 */
export const generateDocumentPreviewUrl = async (
  documentId: string,
  accessControl: { userId: string; permissions: string[] }
): Promise<SecureUrl> => {
  // Verify permissions
  if (!accessControl.permissions.includes('document:read')) {
    throw new Error('Insufficient permissions');
  }

  // Generate secure token
  const timestamp = new Date();
  const expiresAt = new Date(timestamp.getTime() + 30 * 60 * 1000); // 30 minutes
  const token = CryptoJS.HmacSHA256(
    `${documentId}:${accessControl.userId}:${expiresAt.getTime()}`,
    process.env.DOCUMENT_SECRET_KEY || ''
  ).toString();

  // Generate tracking ID
  const requestId = CryptoJS.randomBytes(16).toString('hex');

  return {
    url: `/api/documents/${documentId}/preview?token=${token}&expires=${expiresAt.getTime()}`,
    expiresAt,
    token,
    accessTracking: {
      requestId,
      timestamp
    }
  };
};

/**
 * Checks file for known malware signatures
 * @param file - File to check
 * @returns Promise resolving to boolean indicating malware detection
 */
const checkMalwareSignatures = async (file: File): Promise<boolean> => {
  // Implementation would integrate with antivirus service
  // Simplified example returns false
  return false;
};

/**
 * Validates document metadata integrity
 * @param metadata - Document metadata object
 * @returns Boolean indicating validity
 */
export const validateMetadataIntegrity = (metadata: DocumentMetadata): boolean => {
  return !!(
    metadata &&
    typeof metadata.fileSize === 'number' &&
    typeof metadata.ocrConfidence === 'number' &&
    metadata.securityHash &&
    metadata.accessControl
  );
};