/**
 * Enhanced Attachment Handler for Email Service
 * Implements secure processing, validation, and storage of email attachments
 * @version 1.0.0
 */

import { S3 } from '@aws-sdk/client-s3'; // ^3.0.0
import { ClamScan } from 'clamav.js'; // ^1.0.0
import { default as pdfParse } from 'pdf-parse'; // ^1.1.1
import { createHash, randomBytes } from 'crypto';
import { Logger } from 'winston'; // ^3.8.0

import { EmailAttachment } from '../interfaces/email.interface';
import { validateEmailAttachments } from '../utils/email.validator';

// Constants for attachment processing
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIME_TYPES = ['application/pdf'];
const PROCESSING_TIMEOUT = 300000; // 5 minutes
const SECURITY_CONFIG = {
  encryption: 'AES-256-GCM',
  minPdfVersion: '1.7',
  maxRetries: 3
};

/**
 * Interface for attachment processing results
 */
interface AttachmentProcessingResult {
  success: boolean;
  storageLocation?: string;
  errors: string[];
  metadata: {
    filename: string;
    size: number;
    contentType: string;
    checksum: string;
    processingTime: number;
    securityInfo: {
      virusScanResult: boolean;
      encryptionType: string;
      checksumVerified: boolean;
    };
  };
}

/**
 * Enhanced handler class for secure email attachment processing
 */
export class AttachmentHandler {
  private readonly s3Client: S3;
  private readonly virusScanner: ClamScan;
  private readonly logger: Logger;

  constructor(
    s3Client: S3,
    virusScanner: ClamScan,
    logger: Logger
  ) {
    this.s3Client = s3Client;
    this.virusScanner = virusScanner;
    this.logger = logger;
  }

  /**
   * Process a single email attachment with enhanced security
   */
  public async processAttachment(
    attachment: EmailAttachment
  ): Promise<AttachmentProcessingResult> {
    const startTime = Date.now();
    const result: AttachmentProcessingResult = {
      success: false,
      errors: [],
      metadata: {
        filename: attachment.filename,
        size: attachment.size,
        contentType: attachment.contentType,
        checksum: '',
        processingTime: 0,
        securityInfo: {
          virusScanResult: false,
          encryptionType: SECURITY_CONFIG.encryption,
          checksumVerified: false
        }
      }
    };

    try {
      // Validate attachment
      const validationResult = await this.validateAttachment(attachment);
      if (!validationResult.isValid) {
        result.errors.push(...validationResult.errors);
        return result;
      }

      // Virus scan
      const isSafe = await this.scanForVirus(attachment.content);
      if (!isSafe) {
        result.errors.push('Virus detected in attachment');
        return result;
      }
      result.metadata.securityInfo.virusScanResult = true;

      // Extract and validate PDF metadata
      if (attachment.contentType === 'application/pdf') {
        const pdfMetadata = await this.extractPdfMetadata(attachment.content);
        if (!pdfMetadata.isValid) {
          result.errors.push('Invalid PDF structure');
          return result;
        }
      }

      // Calculate checksum
      result.metadata.checksum = createHash('sha256')
        .update(attachment.content)
        .digest('hex');
      result.metadata.securityInfo.checksumVerified = true;

      // Store attachment
      const storageResult = await this.storeAttachment(attachment);
      if (!storageResult.success) {
        result.errors.push('Failed to store attachment');
        return result;
      }
      result.storageLocation = storageResult.location;

      result.success = true;
    } catch (error) {
      result.errors.push(`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.logger.error('Attachment processing failed', {
        filename: attachment.filename,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      result.metadata.processingTime = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Validate attachment with enhanced security checks
   */
  private async validateAttachment(
    attachment: EmailAttachment
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const validationResult = await validateEmailAttachments([attachment], {
      validateAttachments: true,
      strictMode: true
    });

    return {
      isValid: validationResult.isValid,
      errors: validationResult.errors
    };
  }

  /**
   * Store attachment with encryption and optimization
   */
  private async storeAttachment(
    attachment: EmailAttachment
  ): Promise<{ success: boolean; location?: string }> {
    try {
      const key = `attachments/${randomBytes(16).toString('hex')}/${attachment.filename}`;
      const encryptionKey = randomBytes(32);

      await this.s3Client.putObject({
        Bucket: process.env.ATTACHMENT_BUCKET!,
        Key: key,
        Body: attachment.content,
        ContentType: attachment.contentType,
        ServerSideEncryption: 'AES256',
        Metadata: {
          filename: attachment.filename,
          originalChecksum: createHash('sha256').update(attachment.content).digest('hex')
        }
      });

      return { success: true, location: key };
    } catch (error) {
      this.logger.error('Failed to store attachment', {
        filename: attachment.filename,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { success: false };
    }
  }

  /**
   * Scan attachment for viruses
   */
  private async scanForVirus(content: Buffer): Promise<boolean> {
    try {
      const scanResult = await this.virusScanner.scanBuffer(content);
      return scanResult.isClean;
    } catch (error) {
      this.logger.error('Virus scan failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Extract and validate PDF metadata
   */
  private async extractPdfMetadata(
    content: Buffer
  ): Promise<{ isValid: boolean; metadata?: any }> {
    try {
      const data = await pdfParse(content);
      const isValidVersion = parseFloat(data.info.PDFFormatVersion) >= 
        parseFloat(SECURITY_CONFIG.minPdfVersion);

      return {
        isValid: isValidVersion,
        metadata: data.info
      };
    } catch (error) {
      this.logger.error('PDF metadata extraction failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { isValid: false };
    }
  }
}