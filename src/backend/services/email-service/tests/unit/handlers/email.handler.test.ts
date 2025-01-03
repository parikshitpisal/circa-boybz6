import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import winston from 'winston';
import { CircuitBreaker } from 'circuit-breaker-ts';
import { EmailHandler } from '../../src/handlers/email.handler';
import { EmailMessage } from '../../src/interfaces/email.interface';
import { ImapService } from '../../src/services/imap.service';
import { SMTPService } from '../../src/services/smtp.service';
import { AttachmentHandler } from '../../src/handlers/attachment.handler';

// Test constants
const TEST_TIMEOUT = 5000;
const SECURITY_CONSTANTS = {
  MAX_ATTACHMENT_SIZE: 25 * 1024 * 1024, // 25MB
  ALLOWED_DOMAINS: ['dollarfunding.com', 'trusted-partner.com'],
  ALLOWED_FILE_TYPES: ['application/pdf']
};

describe('EmailHandler', () => {
  let emailHandler: EmailHandler;
  let mockImapService: jest.Mocked<ImapService>;
  let mockSmtpService: jest.Mocked<SMTPService>;
  let mockAttachmentHandler: jest.Mocked<AttachmentHandler>;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;
  let mockLogger: jest.Mocked<winston.Logger>;

  beforeEach(() => {
    // Setup mocks
    mockImapService = {
      initialize: jest.fn(),
      monitorEmails: jest.fn(),
      getConnectionHealth: jest.fn(),
    } as any;

    mockSmtpService = {
      sendEmail: jest.fn(),
      verifyConnection: jest.fn(),
    } as any;

    mockAttachmentHandler = {
      processAttachment: jest.fn(),
    } as any;

    mockCircuitBreaker = {
      execute: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    // Initialize EmailHandler with mocks
    emailHandler = new EmailHandler(
      mockImapService,
      mockSmtpService,
      mockAttachmentHandler,
      mockCircuitBreaker
    );

    // Replace internal logger with mock
    (emailHandler as any).logger = mockLogger;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize()', () => {
    it('should initialize email handler with all dependencies', async () => {
      await emailHandler.initialize();

      expect(mockImapService.initialize).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Email handler initialized successfully');
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      mockImapService.initialize.mockRejectedValue(error);

      await expect(emailHandler.initialize()).rejects.toThrow('Initialization failed');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize email handler', { error });
    });
  });

  describe('processEmail()', () => {
    const validEmailMessage: EmailMessage = {
      id: 'test-123',
      from: 'test@dollarfunding.com',
      subject: 'Test Application',
      receivedDate: new Date(),
      attachments: [{
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 1024,
        content: Buffer.from('test'),
        checksum: 'test-checksum'
      }],
      status: 'PENDING',
      processingMetadata: {
        attempts: 0,
        lastAttempt: new Date(),
        processingNode: 'test-node',
        metrics: {
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          attachmentCount: 1,
          totalSize: 1024
        }
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('should process valid email with attachments successfully', async () => {
      mockAttachmentHandler.processAttachment.mockResolvedValue({ success: true, errors: [] });
      mockCircuitBreaker.execute.mockImplementation(fn => fn());

      await emailHandler.processEmail(validEmailMessage);

      expect(mockAttachmentHandler.processAttachment).toHaveBeenCalledWith(validEmailMessage.attachments[0]);
      expect(mockLogger.info).toHaveBeenCalledWith('Email processed successfully', { messageId: validEmailMessage.id });
    });

    it('should handle attachment processing failures', async () => {
      mockAttachmentHandler.processAttachment.mockResolvedValue({ 
        success: false, 
        errors: ['Invalid file type'] 
      });
      mockCircuitBreaker.execute.mockImplementation(fn => fn());

      await expect(emailHandler.processEmail(validEmailMessage))
        .rejects.toThrow('Attachment processing failed: Invalid file type');
    });

    it('should enforce attachment size limits', async () => {
      const largeAttachment = {
        ...validEmailMessage.attachments[0],
        size: SECURITY_CONSTANTS.MAX_ATTACHMENT_SIZE + 1
      };
      const messageWithLargeAttachment = {
        ...validEmailMessage,
        attachments: [largeAttachment]
      };

      await expect(emailHandler.processEmail(messageWithLargeAttachment))
        .rejects.toThrow(/Attachment size exceeds limit/);
    });

    it('should validate sender domain', async () => {
      const invalidSenderMessage = {
        ...validEmailMessage,
        from: 'test@invalid-domain.com'
      };

      await expect(emailHandler.processEmail(invalidSenderMessage))
        .rejects.toThrow(/Invalid sender domain/);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors with retry logic', async () => {
      const networkError = new Error('Network error');
      mockCircuitBreaker.execute.mockRejectedValue(networkError);

      await expect(emailHandler.processEmail({} as EmailMessage))
        .rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should move messages to DLQ after max retries', async () => {
      const message: EmailMessage = {
        ...validEmailMessage,
        processingMetadata: {
          ...validEmailMessage.processingMetadata,
          attempts: 3
        }
      };

      mockCircuitBreaker.execute.mockRejectedValue(new Error('Processing failed'));

      await expect(emailHandler.processEmail(message)).rejects.toThrow();
      expect(mockLogger.warn).toHaveBeenCalledWith('Message moved to DLQ', { messageId: message.id });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track email processing duration', async () => {
      const startTime = Date.now();
      mockCircuitBreaker.execute.mockImplementation(async fn => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return fn();
      });

      await emailHandler.processEmail(validEmailMessage);

      const metrics = emailHandler.getMetrics();
      expect(metrics.processingDuration.get()).toBeGreaterThan(0);
      expect(Date.now() - startTime).toBeGreaterThan(100);
    });

    it('should monitor active connections', async () => {
      await emailHandler.initialize();
      const metrics = emailHandler.getMetrics();
      expect(metrics.activeConnections.get()).toBe(10); // CONNECTION_POOL_SIZE
    });
  });

  describe('Security Features', () => {
    it('should validate email headers', async () => {
      const messageWithSuspiciousHeaders = {
        ...validEmailMessage,
        headers: {
          'bcc': 'suspicious@example.com'
        }
      };

      await expect(emailHandler.processEmail(messageWithSuspiciousHeaders))
        .rejects.toThrow(/Suspicious headers detected/);
    });

    it('should verify attachment checksums', async () => {
      const messageWithInvalidChecksum = {
        ...validEmailMessage,
        attachments: [{
          ...validEmailMessage.attachments[0],
          checksum: 'invalid-checksum'
        }]
      };

      mockAttachmentHandler.processAttachment.mockResolvedValue({
        success: false,
        errors: ['Checksum verification failed']
      });

      await expect(emailHandler.processEmail(messageWithInvalidChecksum))
        .rejects.toThrow(/Checksum verification failed/);
    });
  });
});