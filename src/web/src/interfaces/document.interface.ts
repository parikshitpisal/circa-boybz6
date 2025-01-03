/**
 * Document Interfaces
 * Defines TypeScript interfaces for document management in the AI-Driven Application Intake Platform
 * @version 1.0.0
 */

import { 
  APPLICATION_STATUS, 
  DOCUMENT_TYPE 
} from '../constants/application.constants';

/**
 * Processing metrics interface for detailed performance tracking
 */
interface ProcessingMetrics {
  processingTime: number;
  queueWaitTime: number;
  ocrAccuracy: number;
  processingSteps: string[];
  stepDurations: Record<string, number>;
}

/**
 * Document retention and compliance policy interface
 */
interface RetentionPolicy {
  retentionDate: Date;
  policyType: string;
  complianceRequirements: string[];
  archivalRequired: boolean;
}

/**
 * Document access tracking record interface
 */
interface AccessRecord {
  timestamp: Date;
  userId: string;
  action: string;
  ipAddress: string;
  metadata: Record<string, any>;
}

/**
 * Accessibility properties for document viewer
 */
interface AccessibilityProps {
  ariaLabel: string;
  role: string;
  isTabFocusable: boolean;
  ariaDescriptions: Record<string, string>;
}

/**
 * Extended document metadata interface with compliance and processing metrics
 */
export interface DocumentMetadata {
  fileSize: number;
  mimeType: string;
  pageCount: number;
  ocrConfidence: number;
  processingDuration: number;
  extractedData: Record<string, any>;
  validationErrors: string[];
  processingMetrics: ProcessingMetrics;
  retentionPolicy: RetentionPolicy;
  complianceFlags: string[];
}

/**
 * Security-related metadata for document integrity and access tracking
 */
export interface SecurityMetadata {
  securityHash: string;
  encryptionStatus: boolean;
  lastValidated: Date;
  accessHistory: AccessRecord[];
}

/**
 * Main document interface for frontend operations with enhanced security features
 */
export interface Document {
  id: string;
  applicationId: string;
  type: DOCUMENT_TYPE;
  status: APPLICATION_STATUS;
  createdAt: Date;
  updatedAt: Date;
  metadata: DocumentMetadata;
  securityInfo: SecurityMetadata;
}

/**
 * Props interface for document viewer component with accessibility support
 */
export interface DocumentViewerProps {
  document: Document;
  previewUrl: string;
  downloadUrl: string;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  accessibilityProps: AccessibilityProps;
}