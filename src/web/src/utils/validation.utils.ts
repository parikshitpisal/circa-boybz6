/**
 * Validation Utilities
 * High-performance, security-compliant validation functions for application data
 * @version 1.0.0
 */

import * as yup from 'yup';
import validator from 'validator';
import { IApplication } from '../interfaces/application.interface';
import { Document } from '../interfaces/document.interface';
import { LoginCredentials } from '../interfaces/auth.interface';
import { 
  VALIDATION_RULES, 
  ERROR_MESSAGES,
  DOCUMENT_TYPE 
} from '../constants/application.constants';

// Performance tracking decorator
function performanceTrack() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const start = performance.now();
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      console.debug(`${propertyKey} execution time: ${duration}ms`);
      return result;
    };
    return descriptor;
  };
}

// Audit logging decorator
function auditLog() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      console.info(`Validation audit: ${propertyKey}`, {
        timestamp: new Date(),
        result: result.success,
        errors: result.errors
      });
      return result;
    };
    return descriptor;
  };
}

// Validation schemas with caching
const validationSchemas = {
  merchantData: yup.object({
    businessName: yup.string().required().min(2),
    ein: yup.string().required().matches(/^\d{2}-\d{7}$/),
    dba: yup.string().nullable(),
    address: yup.object({
      street: yup.string().required(),
      city: yup.string().required(),
      state: yup.string().required().length(2),
      zipCode: yup.string().required().matches(/^\d{5}(-\d{4})?$/),
      country: yup.string().required()
    }),
    ownerInfo: yup.object({
      firstName: yup.string().required(),
      lastName: yup.string().required(),
      ssn: yup.string().required().matches(/^\d{3}-\d{2}-\d{4}$/),
      dateOfBirth: yup.date().max(new Date()),
      phoneNumber: yup.string().required().matches(/^\+?1?\d{10}$/),
      email: yup.string().required().email(),
      ownership: yup.number().required().min(0).max(100)
    }),
    financialInfo: yup.object({
      bankName: yup.string().required(),
      accountNumber: yup.string().required(),
      routingNumber: yup.string().required().length(9),
      monthlyRevenue: yup.number().required().min(VALIDATION_RULES.MIN_MONTHLY_REVENUE),
      annualRevenue: yup.number().required(),
      outstandingLoans: yup.number().required().min(0),
      creditCardVolume: yup.number().required().min(0)
    })
  }).required()
};

interface ValidationOptions {
  strictMode?: boolean;
  validateDocuments?: boolean;
  securityCheck?: boolean;
}

interface ValidationResult {
  success: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  metadata: {
    processingTime: number;
    validationLevel: string;
    timestamp: Date;
  };
}

interface DocumentValidationResult {
  success: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  ocrConfidence: number;
  metadata: {
    processingTime: number;
    documentType: DOCUMENT_TYPE;
    timestamp: Date;
  };
}

/**
 * Validates a complete merchant cash advance application
 * Implements comprehensive validation with security compliance
 */
@performanceTrack()
@auditLog()
export async function validateApplication(
  application: IApplication,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const errors: Array<{ field: string; message: string; code: string }> = [];
  const startTime = performance.now();

  try {
    // Validate merchant data
    await validationSchemas.merchantData.validate(application.merchantData, {
      abortEarly: false,
      strict: options.strictMode
    });

    // Validate business metrics
    if (application.merchantData.businessMetrics) {
      if (application.merchantData.businessMetrics.monthsInBusiness < VALIDATION_RULES.MIN_YEARS_IN_BUSINESS * 12) {
        errors.push({
          field: 'businessMetrics.monthsInBusiness',
          message: ERROR_MESSAGES.INVALID_YEARS.replace('{0}', String(VALIDATION_RULES.MIN_YEARS_IN_BUSINESS)),
          code: 'INVALID_BUSINESS_AGE'
        });
      }

      if (application.merchantData.businessMetrics.creditScore < VALIDATION_RULES.MIN_CREDIT_SCORE) {
        errors.push({
          field: 'businessMetrics.creditScore',
          message: ERROR_MESSAGES.INVALID_CREDIT.replace('{0}', String(VALIDATION_RULES.MIN_CREDIT_SCORE)),
          code: 'INVALID_CREDIT_SCORE'
        });
      }
    }

    // Validate documents if required
    if (options.validateDocuments && application.documents) {
      for (const document of application.documents) {
        const docValidation = await validateDocument(document);
        if (!docValidation.success) {
          errors.push(...docValidation.errors);
        }
      }
    }

    // Security compliance checks
    if (options.securityCheck) {
      const securityErrors = validateSecurityCompliance(application);
      errors.push(...securityErrors);
    }

  } catch (yupError: any) {
    if (yupError.inner) {
      yupError.inner.forEach((err: any) => {
        errors.push({
          field: err.path,
          message: err.message,
          code: 'VALIDATION_ERROR'
        });
      });
    }
  }

  return {
    success: errors.length === 0,
    errors,
    metadata: {
      processingTime: performance.now() - startTime,
      validationLevel: options.strictMode ? 'strict' : 'standard',
      timestamp: new Date()
    }
  };
}

/**
 * Validates individual documents with OCR quality verification
 * Implements document-specific validation rules
 */
@performanceTrack()
@auditLog()
export async function validateDocument(
  document: Document,
  options: ValidationOptions = {}
): Promise<DocumentValidationResult> {
  const errors: Array<{ field: string; message: string; code: string }> = [];
  const startTime = performance.now();

  // Validate file metadata
  if (document.metadata.fileSize > VALIDATION_RULES.MAX_FILE_SIZE * 1024 * 1024) {
    errors.push({
      field: 'fileSize',
      message: ERROR_MESSAGES.INVALID_FILE_SIZE.replace('{0}', String(VALIDATION_RULES.MAX_FILE_SIZE)),
      code: 'FILE_TOO_LARGE'
    });
  }

  // Validate OCR confidence
  if (document.metadata.ocrConfidence < 0.85) {
    errors.push({
      field: 'ocrConfidence',
      message: 'OCR confidence below required threshold',
      code: 'LOW_OCR_CONFIDENCE'
    });
  }

  // Document type-specific validation
  switch (document.type) {
    case DOCUMENT_TYPE.BANK_STATEMENT:
      if (!document.metadata.extractedData.accountNumber) {
        errors.push({
          field: 'extractedData.accountNumber',
          message: 'Bank account number not found',
          code: 'MISSING_ACCOUNT_NUMBER'
        });
      }
      break;
    case DOCUMENT_TYPE.VOIDED_CHECK:
      if (!document.metadata.extractedData.routingNumber) {
        errors.push({
          field: 'extractedData.routingNumber',
          message: 'Routing number not found',
          code: 'MISSING_ROUTING_NUMBER'
        });
      }
      break;
  }

  return {
    success: errors.length === 0,
    errors,
    ocrConfidence: document.metadata.ocrConfidence,
    metadata: {
      processingTime: performance.now() - startTime,
      documentType: document.type,
      timestamp: new Date()
    }
  };
}

/**
 * Validates security compliance requirements
 * Implements PCI DSS and GLBA compliance checks
 */
function validateSecurityCompliance(
  application: IApplication
): Array<{ field: string; message: string; code: string }> {
  const errors: Array<{ field: string; message: string; code: string }> = [];

  // PCI DSS compliance checks
  if (application.merchantData.financialInfo) {
    const { accountNumber } = application.merchantData.financialInfo;
    if (!validator.isCreditCard(accountNumber)) {
      errors.push({
        field: 'financialInfo.accountNumber',
        message: 'Invalid account number format',
        code: 'PCI_COMPLIANCE_ERROR'
      });
    }
  }

  // GLBA compliance checks
  if (application.merchantData.ownerInfo) {
    const { ssn } = application.merchantData.ownerInfo;
    if (!validator.matches(ssn, /^\d{3}-\d{2}-\d{4}$/)) {
      errors.push({
        field: 'ownerInfo.ssn',
        message: 'Invalid SSN format',
        code: 'GLBA_COMPLIANCE_ERROR'
      });
    }
  }

  return errors;
}