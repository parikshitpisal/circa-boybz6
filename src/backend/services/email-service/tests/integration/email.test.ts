/**
 * Integration Tests for Email Service
 * Tests end-to-end email processing pipeline with security features
 * @version 1.0.0
 */

import { describe, beforeAll, afterAll, test, expect } from '@jest/globals';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Connection, connect } from 'amqplib';
import { IMAPServer } from 'node-imap-test';
import { createTestEmailAccount, generateTestMessage } from '@test/utils';

import { EmailHandler } from '../../src/handlers/email.handler';
import { EmailMessage } from '../../src/interfaces/email.interface';

// Test configuration constants
const TEST_EMAIL_CONFIG = {
  host: 'localhost',
  port: 1433,
  secure: true,
  auth: {
    user: 'test@example.com',
    pass: 'testpass'
  },
  tls: {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
  },
  pool: {
    maxConnections: 10,
    idleTimeout: 300000
  }
};

const TEST_QUEUE_CONFIG = {
  name: 'test-email-processing',
  dlq: 'test-email-processing-dlq',
  retryLimit: 3,
  retryDelay: 1000
};

describe('Email Service Integration Tests', () => {
  let emailHandler: EmailHandler;
  let rabbitContainer: StartedTestContainer;
  let imapServer: IMAPServer;
  let queueConnection: Connection;
  let testAccount: { user: string; pass: string };

  beforeAll(async () => {
    // Start RabbitMQ test container
    rabbitContainer = await new GenericContainer('rabbitmq:3.9-alpine')
      .withExposedPorts(5672)
      .withHealthCheck({
        test: ['CMD', 'rabbitmq-diagnostics', 'check_port_connectivity'],
        interval: 1000,
        timeout: 3000,
        retries: 5
      })
      .start();

    // Setup IMAP test server
    imapServer = new IMAPServer({
      port: TEST_EMAIL_CONFIG.port,
      secure: true,
      debug: false,
      tls: TEST_EMAIL_CONFIG.tls
    });
    await imapServer.start();

    // Create test email account
    testAccount = await createTestEmailAccount(imapServer);

    // Setup RabbitMQ connection
    const rabbitPort = rabbitContainer.getMappedPort(5672);
    queueConnection = await connect(`amqp://localhost:${rabbitPort}`);
    const channel = await queueConnection.createChannel();

    // Setup queues
    await channel.assertQueue(TEST_QUEUE_CONFIG.name, { durable: true });
    await channel.assertQueue(TEST_QUEUE_CONFIG.dlq, { durable: true });

    // Initialize EmailHandler with test configuration
    emailHandler = new EmailHandler({
      ...TEST_EMAIL_CONFIG,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    await emailHandler.initialize();
  });

  afterAll(async () => {
    // Cleanup resources
    await emailHandler.shutdown();
    await imapServer.stop();
    await queueConnection.close();
    await rabbitContainer.stop();
  });

  test('should process email with attachments successfully', async () => {
    // Generate test message with attachments
    const testMessage: EmailMessage = await generateTestMessage({
      from: 'sender@dollarfunding.com',
      subject: 'Test Application',
      attachments: [
        {
          filename: 'test.pdf',
          contentType: 'application/pdf',
          size: 1024,
          content: Buffer.from('test PDF content'),
          checksum: 'test-checksum'
        }
      ]
    });

    // Process the email
    await emailHandler.processEmail(testMessage);

    // Verify message was processed
    const processedMessage = await emailHandler.getProcessedMessage(testMessage.id);
    expect(processedMessage).toBeDefined();
    expect(processedMessage.status).toBe('COMPLETED');
    expect(processedMessage.validationResult?.isValid).toBe(true);
  });

  test('should handle invalid attachments correctly', async () => {
    // Generate test message with invalid attachment
    const testMessage: EmailMessage = await generateTestMessage({
      from: 'sender@dollarfunding.com',
      subject: 'Test Invalid Application',
      attachments: [
        {
          filename: 'test.exe',
          contentType: 'application/x-msdownload',
          size: 1024,
          content: Buffer.from('invalid content'),
          checksum: 'test-checksum'
        }
      ]
    });

    // Process the email
    await emailHandler.processEmail(testMessage);

    // Verify message was rejected
    const processedMessage = await emailHandler.getProcessedMessage(testMessage.id);
    expect(processedMessage.status).toBe('VALIDATION_FAILED');
    expect(processedMessage.validationResult?.errors).toContain('Invalid file type');
  });

  test('should handle connection pool correctly', async () => {
    // Generate multiple concurrent requests
    const requests = Array(15).fill(null).map(async (_, index) => {
      const testMessage = await generateTestMessage({
        from: 'sender@dollarfunding.com',
        subject: `Test Message ${index}`,
        attachments: []
      });
      return emailHandler.processEmail(testMessage);
    });

    // Process all requests
    await Promise.all(requests);

    // Verify connection pool metrics
    const metrics = await emailHandler.getMetrics();
    expect(metrics.activeConnections).toBeLessThanOrEqual(TEST_EMAIL_CONFIG.pool.maxConnections);
  });

  test('should handle security validation correctly', async () => {
    // Generate test message with security context
    const testMessage: EmailMessage = await generateTestMessage({
      from: 'unauthorized@example.com',
      subject: 'Test Security',
      attachments: []
    });

    // Process the email
    await emailHandler.processEmail(testMessage);

    // Verify security validation
    const processedMessage = await emailHandler.getProcessedMessage(testMessage.id);
    expect(processedMessage.status).toBe('VALIDATION_FAILED');
    expect(processedMessage.validationResult?.errors).toContain('Invalid sender domain');
  });

  test('should handle message queue integration correctly', async () => {
    // Generate test message
    const testMessage: EmailMessage = await generateTestMessage({
      from: 'sender@dollarfunding.com',
      subject: 'Test Queue',
      attachments: []
    });

    // Process the email
    await emailHandler.processEmail(testMessage);

    // Verify message in queue
    const channel = await queueConnection.createChannel();
    const message = await channel.get(TEST_QUEUE_CONFIG.name);
    expect(message).toBeDefined();
    expect(JSON.parse(message!.content.toString()).id).toBe(testMessage.id);
  });

  test('should handle retry mechanism correctly', async () => {
    // Generate test message that will trigger retries
    const testMessage: EmailMessage = await generateTestMessage({
      from: 'sender@dollarfunding.com',
      subject: 'Test Retry',
      attachments: [],
      forceRetry: true // Custom flag to simulate processing failure
    });

    // Process the email
    await emailHandler.processEmail(testMessage);

    // Verify retry attempts
    const processedMessage = await emailHandler.getProcessedMessage(testMessage.id);
    expect(processedMessage.processingMetadata.attempts).toBeGreaterThan(1);
    expect(processedMessage.processingMetadata.attempts).toBeLessThanOrEqual(TEST_QUEUE_CONFIG.retryLimit);
  });
});