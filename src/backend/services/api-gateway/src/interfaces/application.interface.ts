/**
 * TypeScript interface definitions for merchant cash advance applications
 * Provides comprehensive type safety and validation for application processing
 * @version 1.0.0
 */

import { BaseDocument } from '../../../shared/interfaces/common';
import { APPLICATION_STATUS } from '../../../shared/constants';

/**
 * Type alias for sensitive encrypted string data
 */
type EncryptedString = string;

/**
 * Type alias for monetary amounts with validation
 */
type MonetaryAmount = number;

/**
 * Interface for validation errors with detailed tracking
 */
interface IValidationError {
  field: string;
  message: string;
  code: string;
  timestamp: Date;
}

/**
 * Interface for processing history entries
 */
interface IProcessingHistory {
  status: APPLICATION_STATUS;
  timestamp: Date;
  duration: number;
  notes?: string;
}

/**
 * Interface for audit log entries
 */
interface IAuditLog {
  action: string;
  performedBy: string;
  timestamp: Date;
  details: Record<string, any>;
}

/**
 * Interface for processing timestamps
 */
interface IProcessingTimestamp {
  stage: string;
  startTime: Date;
  endTime: Date;
  duration: number;
}

/**
 * Interface for business validation results
 */
interface IBusinessValidation {
  isVerified: boolean;
  verificationSource: string;
  verificationDate: Date;
  score: number;
  flags: string[];
}

/**
 * Interface for identity verification
 */
interface IIdentityValidation {
  isVerified: boolean;
  method: string;
  verificationDate: Date;
  score: number;
  flags: string[];
}

/**
 * Interface for financial validation
 */
interface IFinancialValidation {
  isVerified: boolean;
  creditScore?: number;
  riskScore: number;
  flags: string[];
  lastVerified: Date;
}

/**
 * Interface for address information with validation
 */
export interface IAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  isVerified: boolean;
}

/**
 * Interface for business owner information with enhanced security
 */
export interface IOwnerInfo {
  name: string;
  ssn: EncryptedString;
  dob: string;
  email: string;
  phone: string;
  identityVerification: IIdentityValidation;
}

/**
 * Interface for financial information with strict validation
 */
export interface IFinancialInfo {
  monthlyRevenue: MonetaryAmount;
  requestedAmount: MonetaryAmount;
  bankAccountNumber: EncryptedString;
  routingNumber: EncryptedString;
  validation: IFinancialValidation;
}

/**
 * Interface for merchant business information with enhanced validation
 */
export interface IMerchantData {
  businessName: string;
  ein: EncryptedString;
  dba: string;
  address: IAddress;
  ownerInfo: IOwnerInfo;
  financialInfo: IFinancialInfo;
  validation: IBusinessValidation;
}

/**
 * Enhanced interface for application processing metadata
 */
export interface IApplicationMetadata {
  processingDuration: number;
  extractedData: Record<string, any>;
  validationErrors: IValidationError[];
  processingHistory: IProcessingHistory[];
  auditTrail: IAuditLog[];
}

/**
 * Interface for detailed processing metrics
 */
export interface IProcessingMetrics {
  ocrConfidence: number;
  dataExtractionAccuracy: number;
  processingAttempts: number;
  timestamps: IProcessingTimestamp[];
}

/**
 * Main application interface with comprehensive tracking and validation
 * Extends BaseDocument to inherit core tracking fields
 */
export interface IApplication extends BaseDocument {
  status: APPLICATION_STATUS;
  emailSource: string;
  merchantData: IMerchantData;
  documents: string[];
  metadata: IApplicationMetadata;
  processingMetrics: IProcessingMetrics;
}