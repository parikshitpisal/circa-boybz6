/**
 * Email Validator Utility Module
 * Implements comprehensive email validation with enhanced security features
 * @version 1.0.0
 */

import { EmailMessage, EmailAttachment, ValidationSeverity } from '../interfaces/email.interface';
import { emailConfig } from '../config/email.config';

// Constants for email validation
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const ALLOWED_MIME_TYPES = emailConfig.emailProcessing.allowedFileTypes;
const MAX_ATTACHMENT_SIZE = emailConfig.emailProcessing.maxAttachmentSize;
const MAX_ATTACHMENTS = emailConfig.emailProcessing.maxAttachments;

// Cache for domain validation results
const domainValidationCache = new Map<string, { isValid: boolean; timestamp: number }>();
const DOMAIN_CACHE_TTL = 3600000; // 1 hour in milliseconds

/**
 * Interface for validation results with enhanced security context
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  securityFlags: SecurityContext;
  metrics: ValidationMetrics;
}

/**
 * Interface for security validation flags
 */
interface SecurityContext {
  domainVerified: boolean;
  attachmentsSafe: boolean;
  headersSanitized: boolean;
}

/**
 * Interface for validation performance metrics
 */
interface ValidationMetrics {
  validationTime: number;
  attachmentProcessingTime: number;
  securityCheckTime: number;
}

/**
 * Interface for validation options
 */
interface ValidationOptions {
  validateSender?: boolean;
  validateAttachments?: boolean;
  validateHeaders?: boolean;
  strictMode?: boolean;
}

/**
 * Validates an email message with comprehensive security checks
 * @param message - Email message to validate
 * @param options - Validation options
 * @returns Detailed validation result with security context
 */
export async function validateEmailMessage(
  message: EmailMessage,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const startTime = Date.now();
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    securityFlags: {
      domainVerified: false,
      attachmentsSafe: false,
      headersSanitized: false
    },
    metrics: {
      validationTime: 0,
      attachmentProcessingTime: 0,
      securityCheckTime: 0
    }
  };

  try {
    // Validate sender domain
    if (options.validateSender !== false) {
      const securityStart = Date.now();
      const domainResult = await validateSenderDomain(message.from);
      if (!domainResult.isValid) {
        result.errors.push(`Invalid sender domain: ${domainResult.errors[0]}`);
        result.isValid = false;
      }
      result.securityFlags.domainVerified = domainResult.isValid;
      result.metrics.securityCheckTime = Date.now() - securityStart;
    }

    // Validate required fields
    if (!message.subject?.trim()) {
      result.errors.push('Subject is required');
      result.isValid = false;
    }

    // Validate headers if required
    if (options.validateHeaders !== false) {
      const headerResult = validateHeaders(message.headers);
      if (!headerResult.isValid) {
        result.warnings.push(...headerResult.warnings);
        result.securityFlags.headersSanitized = false;
      } else {
        result.securityFlags.headersSanitized = true;
      }
    }

    // Validate attachments
    if (options.validateAttachments !== false && message.attachments) {
      const attachmentStart = Date.now();
      const attachmentResult = await validateEmailAttachments(message.attachments, options);
      result.errors.push(...attachmentResult.errors);
      result.warnings.push(...attachmentResult.warnings);
      result.securityFlags.attachmentsSafe = attachmentResult.isValid;
      result.metrics.attachmentProcessingTime = Date.now() - attachmentStart;

      if (!attachmentResult.isValid) {
        result.isValid = false;
      }
    }

  } catch (error) {
    result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.isValid = false;
  }

  result.metrics.validationTime = Date.now() - startTime;
  return result;
}

/**
 * Validates email attachments with enhanced security features
 * @param attachments - Array of email attachments
 * @param options - Validation options
 * @returns Validation result for attachments
 */
export async function validateEmailAttachments(
  attachments: EmailAttachment[],
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    securityFlags: {
      domainVerified: true,
      attachmentsSafe: true,
      headersSanitized: true
    },
    metrics: {
      validationTime: 0,
      attachmentProcessingTime: 0,
      securityCheckTime: 0
    }
  };

  const startTime = Date.now();

  try {
    // Validate attachment count
    if (attachments.length > MAX_ATTACHMENTS) {
      result.errors.push(`Too many attachments. Maximum allowed: ${MAX_ATTACHMENTS}`);
      result.isValid = false;
      return result;
    }

    // Validate each attachment
    let totalSize = 0;
    for (const attachment of attachments) {
      // Validate MIME type
      if (!ALLOWED_MIME_TYPES.includes(attachment.contentType)) {
        result.errors.push(`Invalid file type: ${attachment.contentType}`);
        result.isValid = false;
      }

      // Validate file size
      if (attachment.size > MAX_ATTACHMENT_SIZE) {
        result.errors.push(`File too large: ${attachment.filename}`);
        result.isValid = false;
      }

      totalSize += attachment.size;

      // Validate filename
      if (!/^[\w\-. ]+$/.test(attachment.filename)) {
        result.warnings.push(`Suspicious filename: ${attachment.filename}`);
      }

      // Verify checksum if available
      if (attachment.checksum && options.strictMode) {
        // Implement checksum verification logic here
        result.securityFlags.attachmentsSafe = true;
      }
    }

    // Validate total attachment size
    if (totalSize > MAX_ATTACHMENT_SIZE * MAX_ATTACHMENTS) {
      result.errors.push('Total attachment size exceeds maximum allowed');
      result.isValid = false;
    }

  } catch (error) {
    result.errors.push(`Attachment validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.isValid = false;
  }

  result.metrics.validationTime = Date.now() - startTime;
  return result;
}

/**
 * Validates sender domain with caching
 * @param emailAddress - Email address to validate
 * @returns Domain validation result
 */
async function validateSenderDomain(emailAddress: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    securityFlags: {
      domainVerified: false,
      attachmentsSafe: true,
      headersSanitized: true
    },
    metrics: {
      validationTime: 0,
      attachmentProcessingTime: 0,
      securityCheckTime: 0
    }
  };

  const startTime = Date.now();

  try {
    // Basic email format validation
    if (!EMAIL_REGEX.test(emailAddress)) {
      result.errors.push('Invalid email format');
      result.isValid = false;
      return result;
    }

    // Extract domain
    const domain = emailAddress.split('@')[1].toLowerCase();

    // Check cache
    const cachedResult = domainValidationCache.get(domain);
    if (cachedResult && (Date.now() - cachedResult.timestamp) < DOMAIN_CACHE_TTL) {
      result.isValid = cachedResult.isValid;
      result.securityFlags.domainVerified = cachedResult.isValid;
      return result;
    }

    // Validate against allowed domains
    const isAllowedDomain = emailConfig.emailProcessing.allowedDomains.includes(domain);
    result.isValid = isAllowedDomain;
    result.securityFlags.domainVerified = isAllowedDomain;

    if (!isAllowedDomain) {
      result.errors.push(`Domain ${domain} is not in the allowed list`);
    }

    // Update cache
    domainValidationCache.set(domain, {
      isValid: isAllowedDomain,
      timestamp: Date.now()
    });

  } catch (error) {
    result.errors.push(`Domain validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    result.isValid = false;
  }

  result.metrics.validationTime = Date.now() - startTime;
  return result;
}

/**
 * Validates email headers for security
 * @param headers - Email headers to validate
 * @returns Validation result for headers
 */
function validateHeaders(headers: Record<string, string> = {}): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    securityFlags: {
      domainVerified: true,
      attachmentsSafe: true,
      headersSanitized: true
    },
    metrics: {
      validationTime: 0,
      attachmentProcessingTime: 0,
      securityCheckTime: 0
    }
  };

  const startTime = Date.now();

  // Check for required headers
  const requiredHeaders = ['message-id', 'date', 'from'];
  for (const header of requiredHeaders) {
    if (!headers[header]) {
      result.warnings.push(`Missing header: ${header}`);
    }
  }

  // Check for suspicious headers
  const suspiciousHeaders = ['bcc', 'cc'];
  for (const header of suspiciousHeaders) {
    if (headers[header]) {
      result.warnings.push(`Suspicious header present: ${header}`);
    }
  }

  result.metrics.validationTime = Date.now() - startTime;
  return result;
}