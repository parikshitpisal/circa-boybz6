/**
 * Application Schema Definition
 * Implements comprehensive validation rules and type safety for MCA applications
 * @version 1.0.0
 */

import { z } from 'zod'; // v3.22.0
import { BaseDocument } from '../interfaces/common';
import { APPLICATION_STATUS } from '../constants';

// Regular expression patterns for validation
const PATTERNS = {
  EIN: /^\d{2}-\d{7}$/,
  SSN: /^\d{3}-\d{2}-\d{4}$/,
  PHONE: /^\+1\d{10}$/,
  ZIP: /^\d{5}(-\d{4})?$/,
  ROUTING: /^\d{9}$/,
  STATE: /^[A-Z]{2}$/,
} as const;

// Address sub-schema
const AddressSchema = z.object({
  street: z.string().min(1).max(100).trim(),
  city: z.string().min(1).max(50).trim(),
  state: z.string().regex(PATTERNS.STATE, 'Must be a valid 2-letter state code'),
  zipCode: z.string().regex(PATTERNS.ZIP, 'Must be a valid US ZIP code')
});

// Owner information sub-schema with PII validation
const OwnerInfoSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  ssn: z.string().regex(PATTERNS.SSN, 'Must be a valid SSN format').transform((val) => val.trim()),
  dob: z.string()
    .datetime()
    .refine((date) => {
      const age = new Date().getFullYear() - new Date(date).getFullYear();
      return age >= 18 && age <= 100;
    }, 'Owner must be between 18 and 100 years old'),
  email: z.string().email('Must be a valid email address').toLowerCase().trim(),
  phone: z.string().regex(PATTERNS.PHONE, 'Must be a valid E.164 format phone number')
});

// Financial information sub-schema with business rule validation
const FinancialInfoSchema = z.object({
  monthlyRevenue: z.number()
    .min(1000, 'Monthly revenue must be at least $1,000')
    .max(10000000, 'Monthly revenue cannot exceed $10M'),
  requestedAmount: z.number()
    .min(5000, 'Requested amount must be at least $5,000'),
  bankAccountNumber: z.string()
    .min(4, 'Bank account number required')
    .transform((val) => val.trim()),
  routingNumber: z.string()
    .regex(PATTERNS.ROUTING, 'Must be a valid 9-digit routing number')
});

// Merchant data sub-schema combining business and financial information
const MerchantDataSchema = z.object({
  businessName: z.string().min(2).max(100).trim(),
  ein: z.string().regex(PATTERNS.EIN, 'Must be a valid EIN format'),
  dba: z.string().max(100).trim().optional(),
  address: AddressSchema,
  ownerInfo: OwnerInfoSchema,
  financialInfo: FinancialInfoSchema
}).refine((data) => {
  // Business rule: Requested amount cannot exceed 1.5x monthly revenue
  return data.financialInfo.requestedAmount <= data.financialInfo.monthlyRevenue * 1.5;
}, {
  message: 'Requested amount cannot exceed 150% of monthly revenue',
  path: ['financialInfo', 'requestedAmount']
});

// Metadata sub-schema for tracking processing information
const MetadataSchema = z.object({
  processingDuration: z.number().optional(),
  extractedData: z.record(z.any()).optional(),
  validationErrors: z.array(z.string()).optional(),
  processingAttempts: z.number().min(0).max(3).optional(),
  lastProcessedAt: z.date().optional()
});

// Main application schema combining all components with base document fields
export const ApplicationSchema = z.object({
  // Inherit base document fields
  id: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
  
  // Application-specific fields
  status: z.nativeEnum(APPLICATION_STATUS),
  emailSource: z.string().email('Must be a valid email address'),
  merchantData: MerchantDataSchema,
  documents: z.array(z.string().uuid())
    .min(1, 'At least one document is required')
    .max(10, 'Cannot exceed 10 documents'),
  metadata: MetadataSchema,
  processedAt: z.date().optional()
}).refine((data) => {
  // Ensure processedAt is present for completed applications
  return data.status !== APPLICATION_STATUS.COMPLETED || data.processedAt !== undefined;
}, {
  message: 'Processed date is required for completed applications',
  path: ['processedAt']
});

// Type inference from schema for TypeScript usage
export type ApplicationType = z.infer<typeof ApplicationSchema>;

/**
 * Validates application data against schema with enhanced business rules
 * @param applicationData - Raw application data to validate
 * @returns Validation result with detailed error messages
 */
export const validateApplication = async (
  applicationData: unknown
): Promise<BaseDocument['ValidationResult']> => {
  try {
    const validatedData = await ApplicationSchema.parseAsync(applicationData);
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
};