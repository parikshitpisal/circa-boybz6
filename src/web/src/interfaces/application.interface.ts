/**
 * Application Interfaces
 * TypeScript interface definitions for merchant cash advance applications
 * @version 1.0.0
 */

import { APPLICATION_STATUS, DOCUMENT_TYPE } from '../constants/application.constants';

/**
 * Interface for physical address information
 */
interface IAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/**
 * Interface for business owner information
 */
interface IOwnerInfo {
  firstName: string;
  lastName: string;
  ssn: string;
  dateOfBirth: Date;
  phoneNumber: string;
  email: string;
  ownership: number;
}

/**
 * Interface for business financial information
 */
interface IFinancialInfo {
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  monthlyRevenue: number;
  annualRevenue: number;
  outstandingLoans: number;
  creditCardVolume: number;
}

/**
 * Interface for business performance metrics
 */
interface IBusinessMetrics {
  averageMonthlyRevenue: number;
  monthsInBusiness: number;
  creditScore: number;
  industryCategories: string[];
}

/**
 * Interface for document processing and validation
 */
interface IDocument {
  id: string;
  type: DOCUMENT_TYPE;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  processingStatus: APPLICATION_STATUS;
  ocrConfidence: number;
  storagePath: string;
  metadata: Record<string, any>;
}

/**
 * Interface for validation error tracking
 */
interface IValidationError {
  fieldName: string;
  errorCode: string;
  errorMessage: string;
  expectedValue: any;
  actualValue: any;
  timestamp: Date;
}

/**
 * Interface for application processing metadata
 */
interface IApplicationMetadata {
  processingDuration: number;
  extractedData: Record<string, any>;
  validationErrors: IValidationError[];
  processingNotes: string[];
  validationFlags: Record<string, boolean>;
}

/**
 * Interface for processing performance metrics
 */
interface IProcessingMetrics {
  processingDuration: number;
  ocrConfidenceAverage: number;
  validationAttempts: number;
  processingSteps: string[];
  stepDurations: Record<string, number>;
}

/**
 * Interface for merchant business information
 */
interface IMerchantData {
  businessName: string;
  ein: string;
  dba: string;
  address: IAddress;
  ownerInfo: IOwnerInfo;
  financialInfo: IFinancialInfo;
  businessMetrics: IBusinessMetrics;
}

/**
 * Main interface for merchant cash advance applications
 * Includes comprehensive tracking and validation capabilities
 */
export interface IApplication {
  id: string;
  status: APPLICATION_STATUS;
  emailSource: string;
  merchantData: IMerchantData;
  documents: IDocument[];
  metadata: IApplicationMetadata;
  processingMetrics: IProcessingMetrics;
  createdAt: Date;
  updatedAt: Date;
}