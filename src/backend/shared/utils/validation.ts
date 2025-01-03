/**
 * Core validation utility module for AI-Driven Application Intake Platform
 * Provides comprehensive validation functions for applications, documents, and data structures
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { ValidationResult } from '../interfaces/common';
import { ApplicationSchema } from '../schemas/application.schema';
import { DocumentSchema } from '../schemas/document.schema';

/**
 * Configuration options for validation functions
 */
export interface ValidationOptions {
  strict: boolean;
  allowPartial: boolean;
  excludeFields: string[];
}

/**
 * Validates application data against the ApplicationSchema
 * @param applicationData - Application data to validate
 * @returns Promise resolving to validation result
 */
export async function validateApplication(
  applicationData: unknown
): Promise<ValidationResult> {
  try {
    await ApplicationSchema.parse(applicationData);
    return {
      isValid: true,
      errors: [],
      warnings: [],
      validationTimestamp: new Date()
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        warnings: [],
        validationTimestamp: new Date()
      };
    }
    throw error;
  }
}

/**
 * Validates document data against the DocumentSchema
 * @param documentData - Document data to validate
 * @returns Promise resolving to validation result
 */
export async function validateDocument(
  documentData: unknown
): Promise<ValidationResult> {
  try {
    await DocumentSchema.parseAsync(documentData);
    return {
      isValid: true,
      errors: [],
      warnings: [],
      validationTimestamp: new Date()
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        warnings: [],
        validationTimestamp: new Date()
      };
    }
    throw error;
  }
}

/**
 * Enhanced validation for merchant-specific data fields with PII handling
 * @param merchantData - Merchant data to validate
 * @returns Validation result for merchant data
 */
export function validateMerchantData(merchantData: unknown): ValidationResult {
  const MerchantDataSchema = z.object({
    businessName: z.string()
      .min(2, 'Business name must be at least 2 characters')
      .max(100, 'Business name cannot exceed 100 characters'),
    
    ein: z.string()
      .regex(/^\d{2}-\d{7}$/, 'Must be a valid EIN format')
      .refine((ein) => validateEINChecksum(ein), 'Invalid EIN checksum'),
    
    dba: z.string()
      .max(100, 'DBA name cannot exceed 100 characters')
      .optional(),
    
    address: z.object({
      street: z.string().min(1).max(100),
      city: z.string().min(1).max(50),
      state: z.string().regex(/^[A-Z]{2}$/, 'Must be a valid 2-letter state code'),
      zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, 'Must be a valid US ZIP code')
    }),
    
    ownerInfo: z.object({
      name: z.string().min(2).max(100),
      ssn: z.string()
        .regex(/^\d{3}-\d{2}-\d{4}$/, 'Must be a valid SSN format')
        .transform(maskPII),
      dob: z.string().datetime(),
      email: z.string().email(),
      phone: z.string().regex(/^\+1\d{10}$/, 'Must be a valid E.164 format phone number')
    })
  });

  try {
    MerchantDataSchema.parse(merchantData);
    return {
      isValid: true,
      errors: [],
      warnings: [],
      validationTimestamp: new Date()
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        warnings: [],
        validationTimestamp: new Date()
      };
    }
    throw error;
  }
}

/**
 * Enhanced validation for financial data fields with regulatory compliance
 * @param financialData - Financial data to validate
 * @returns Validation result for financial data
 */
export function validateFinancialData(financialData: unknown): ValidationResult {
  const FinancialDataSchema = z.object({
    monthlyRevenue: z.number()
      .min(1000, 'Monthly revenue must be at least $1,000')
      .max(10000000, 'Monthly revenue cannot exceed $10M'),
    
    requestedAmount: z.number()
      .min(5000, 'Requested amount must be at least $5,000')
      .refine(
        (amount, ctx) => amount <= ctx.parent.monthlyRevenue * 1.5,
        'Requested amount cannot exceed 150% of monthly revenue'
      ),
    
    bankAccountNumber: z.string()
      .min(4, 'Bank account number required')
      .transform(maskBankAccount),
    
    routingNumber: z.string()
      .regex(/^\d{9}$/, 'Must be a valid 9-digit routing number')
      .refine(validateRoutingNumber, 'Invalid routing number checksum'),
    
    transactionHistory: z.array(z.object({
      date: z.string().datetime(),
      amount: z.number(),
      type: z.enum(['CREDIT', 'DEBIT']),
      description: z.string()
    })).optional(),
    
    financialRatios: z.object({
      debtServiceCoverage: z.number()
        .min(1.15, 'Debt service coverage ratio must be at least 1.15'),
      currentRatio: z.number()
        .min(1.0, 'Current ratio must be at least 1.0')
    }).optional()
  });

  try {
    FinancialDataSchema.parse(financialData);
    return {
      isValid: true,
      errors: [],
      warnings: [],
      validationTimestamp: new Date()
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`),
        warnings: [],
        validationTimestamp: new Date()
      };
    }
    throw error;
  }
}

/**
 * Validates EIN checksum using IRS algorithm
 * @param ein - EIN to validate
 * @returns boolean indicating if EIN is valid
 */
function validateEINChecksum(ein: string): boolean {
  const digits = ein.replace('-', '').split('').map(Number);
  if (digits.length !== 9) return false;
  
  const weights = [3, 7, 1, 3, 7, 1, 3, 7];
  const sum = digits.slice(0, 8).reduce((acc, digit, idx) => {
    return acc + (digit * weights[idx]);
  }, 0);
  
  const checkDigit = (sum % 10 === 0) ? 0 : 10 - (sum % 10);
  return checkDigit === digits[8];
}

/**
 * Validates routing number using ABA algorithm
 * @param routingNumber - Routing number to validate
 * @returns boolean indicating if routing number is valid
 */
function validateRoutingNumber(routingNumber: string): boolean {
  const digits = routingNumber.split('').map(Number);
  if (digits.length !== 9) return false;
  
  const sum = (
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8])
  );
  
  return sum % 10 === 0;
}

/**
 * Masks PII data for security
 * @param value - Value to mask
 * @returns Masked value
 */
function maskPII(value: string): string {
  return value.replace(/\d(?=\d{4})/g, '*');
}

/**
 * Masks bank account number
 * @param accountNumber - Account number to mask
 * @returns Masked account number
 */
function maskBankAccount(accountNumber: string): string {
  const last4 = accountNumber.slice(-4);
  return `****${last4}`;
}