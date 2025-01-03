import { injectable } from 'inversify';
import * as amqplib from 'amqplib'; // ^0.10.0
import { Logger } from 'winston'; // ^3.8.0
import { config } from '../config';
import { ProcessableDocument } from '../../../../shared/interfaces/common';
import { APPLICATION_STATUS, DOCUMENT_TYPES } from '../../../../shared/constants';

/**
 * Structure for messages sent through the queue with metadata
 */
interface QueueMessage {
  documentId: string;
  type: DOCUMENT_TYPES;
  priority: number;
  timestamp: Date;
  retryCount: number;
  processingMetadata: Record<string, unknown>;
  correlationId: string;
}

/**
 * Configuration options for queue operations
 */
interface QueueOptions {
  priority?: number;
  persistent?: boolean;
  expiration?: number;
  messageTimeout?: number;
  retryLimit?: number;
  deadLetterExchange?: string;
  compression?: boolean;
}

/**
 * Metrics interface for queue monitoring
 */
interface QueueMetrics {
  publishedMessages: number;
  consumedMessages: number;
  failedMessages: number;
  processingTime: number[];
  channelStatus: Map<string, boolean>;
}

@injectable()
export class QueueService {
  private connections: amqplib.Connection[] = [];
  private channels: amqplib.Channel[] = [];
  private readonly metrics: QueueMetrics;
  private readonly connectionPool: Map<string, amqplib.Connection>;
  private readonly channelPool: Map<string, amqplib.Channel>;
  private isInitialized = false;

  constructor(
    private readonly logger: Logger,
    private readonly healthCheck: any
  ) {
    this.metrics = {
      publishedMessages: 0,
      consumedMessages: 0,
      failedMessages: 0,
      processingTime: [],
      channelStatus: new Map()
    };
    this.connectionPool = new Map();
    this.channelPool = new Map();
  }

  /**
   * Initializes the queue service with connection pool and channels
   */
  public async initialize(): Promise<void> {
    try {
      // Create connection pool
      for (let i = 0; i < config.queue.prefetchCount; i++) {
        const connection = await amqplib.connect(config.queue.url, {
          heartbeat: 30,
          timeout: 30000,
          clientProperties: {
            connection_name: `api-gateway-${i}`,
            application: 'application-intake'
          }
        });

        this.setupConnectionHandlers(connection, i);
        this.connections.push(connection);
        this.connectionPool.set(`connection-${i}`, connection);

        // Create channel for each connection
        const channel = await connection.createChannel();
        await this.setupChannel(channel, i);
        this.channels.push(channel);
        this.channelPool.set(`channel-${i}`, channel);
      }

      await this.setupExchangesAndQueues();
      this.isInitialized = true;
      this.logger.info('Queue service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize queue service', { error });
      throw error;
    }
  }

  /**
   * Publishes a document for processing with validation and retry logic
   */
  public async publishDocument(
    document: ProcessableDocument,
    options: QueueOptions = {}
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Queue service not initialized');
    }

    const startTime = Date.now();
    const channel = await this.getAvailableChannel();

    try {
      const message: QueueMessage = {
        documentId: document.id,
        type: document.type,
        priority: options.priority || 0,
        timestamp: new Date(),
        retryCount: 0,
        processingMetadata: document.metadata,
        correlationId: this.generateCorrelationId()
      };

      const queueOptions: amqplib.Options.Publish = {
        persistent: options.persistent ?? true,
        priority: options.priority,
        expiration: options.expiration?.toString(),
        headers: {
          'x-correlation-id': message.correlationId,
          'x-retry-count': 0,
          'x-document-type': document.type
        }
      };

      await channel.publish(
        config.queue.exchange,
        document.type.toLowerCase(),
        Buffer.from(JSON.stringify(message)),
        queueOptions
      );

      this.metrics.publishedMessages++;
      this.metrics.processingTime.push(Date.now() - startTime);

      this.logger.info('Document published to queue', {
        documentId: document.id,
        type: document.type,
        correlationId: message.correlationId
      });
    } catch (error) {
      this.metrics.failedMessages++;
      this.logger.error('Failed to publish document', {
        documentId: document.id,
        error
      });
      throw error;
    }
  }

  /**
   * Consumes messages from a specific queue with error handling
   */
  public async consumeQueue(
    queueName: string,
    messageHandler: (message: QueueMessage) => Promise<void>,
    options: amqplib.Options.Consume = {}
  ): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Queue service not initialized');
    }

    const channel = await this.getAvailableChannel();
    await channel.prefetch(config.queue.prefetchCount);

    try {
      await channel.consume(
        queueName,
        async (msg) => {
          if (!msg) return;

          const startTime = Date.now();
          try {
            const message: QueueMessage = JSON.parse(msg.content.toString());
            await messageHandler(message);
            channel.ack(msg);

            this.metrics.consumedMessages++;
            this.metrics.processingTime.push(Date.now() - startTime);
          } catch (error) {
            this.handleConsumerError(channel, msg, error);
          }
        },
        {
          noAck: false,
          ...options
        }
      );

      this.logger.info(`Consumer started for queue: ${queueName}`);
    } catch (error) {
      this.logger.error(`Failed to setup consumer for queue: ${queueName}`, { error });
      throw error;
    }
  }

  /**
   * Gracefully closes all connections and channels
   */
  public async closeConnection(): Promise<void> {
    try {
      for (const channel of this.channels) {
        await channel.close();
      }
      for (const connection of this.connections) {
        await connection.close();
      }

      this.channels = [];
      this.connections = [];
      this.connectionPool.clear();
      this.channelPool.clear();
      this.isInitialized = false;

      this.logger.info('Queue service connections closed successfully');
    } catch (error) {
      this.logger.error('Error closing queue connections', { error });
      throw error;
    }
  }

  private async setupExchangesAndQueues(): Promise<void> {
    const channel = this.channels[0];

    // Setup main exchange
    await channel.assertExchange(config.queue.exchange, 'direct', {
      durable: true
    });

    // Setup dead letter exchange
    await channel.assertExchange(config.queue.deadLetterExchange, 'direct', {
      durable: true
    });

    // Setup queues for each document type
    for (const type of Object.values(DOCUMENT_TYPES)) {
      const queueName = type.toLowerCase();
      const dlqName = `${queueName}_dlq`;

      await channel.assertQueue(queueName, {
        durable: true,
        deadLetterExchange: config.queue.deadLetterExchange,
        arguments: {
          'x-max-priority': 10,
          'x-message-ttl': 86400000, // 24 hours
          'x-dead-letter-routing-key': dlqName
        }
      });

      await channel.assertQueue(dlqName, {
        durable: true
      });

      await channel.bindQueue(queueName, config.queue.exchange, queueName);
      await channel.bindQueue(dlqName, config.queue.deadLetterExchange, dlqName);
    }
  }

  private async setupChannel(channel: amqplib.Channel, index: number): Promise<void> {
    await channel.prefetch(config.queue.prefetchCount);
    this.metrics.channelStatus.set(`channel-${index}`, true);

    channel.on('error', (error) => {
      this.logger.error(`Channel ${index} error`, { error });
      this.metrics.channelStatus.set(`channel-${index}`, false);
    });

    channel.on('close', () => {
      this.logger.warn(`Channel ${index} closed`);
      this.metrics.channelStatus.set(`channel-${index}`, false);
    });
  }

  private setupConnectionHandlers(connection: amqplib.Connection, index: number): void {
    connection.on('error', (error) => {
      this.logger.error(`Connection ${index} error`, { error });
      this.healthCheck.setUnhealthy(`queue-connection-${index}`);
    });

    connection.on('close', () => {
      this.logger.warn(`Connection ${index} closed`);
      this.healthCheck.setUnhealthy(`queue-connection-${index}`);
      this.attemptReconnection(index);
    });
  }

  private async getAvailableChannel(): Promise<amqplib.Channel> {
    const availableChannels = Array.from(this.channelPool.entries())
      .filter(([_, channel]) => channel && channel.connection.connection.writable);

    if (availableChannels.length === 0) {
      throw new Error('No available channels');
    }

    return availableChannels[Math.floor(Math.random() * availableChannels.length)][1];
  }

  private async handleConsumerError(
    channel: amqplib.Channel,
    msg: amqplib.ConsumeMessage,
    error: Error
  ): Promise<void> {
    const retryCount = (msg.properties.headers['x-retry-count'] || 0) + 1;
    const maxRetries = config.queue.retryPolicy.attempts;

    if (retryCount < maxRetries) {
      const retryDelay = config.queue.retryPolicy.backoff * retryCount;
      await channel.nack(msg, false, false);
      
      this.logger.warn('Message processing failed, scheduling retry', {
        retryCount,
        retryDelay,
        error
      });
    } else {
      await channel.nack(msg, false, false);
      this.metrics.failedMessages++;
      
      this.logger.error('Message processing failed permanently', {
        retryCount,
        error
      });
    }
  }

  private async attemptReconnection(index: number): Promise<void> {
    const backoff = 1000;
    const maxAttempts = 5;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, attempts)));
        const newConnection = await amqplib.connect(config.queue.url);
        const newChannel = await newConnection.createChannel();

        this.connections[index] = newConnection;
        this.channels[index] = newChannel;
        this.connectionPool.set(`connection-${index}`, newConnection);
        this.channelPool.set(`channel-${index}`, newChannel);

        this.setupConnectionHandlers(newConnection, index);
        await this.setupChannel(newChannel, index);

        this.logger.info(`Successfully reconnected connection ${index}`);
        this.healthCheck.setHealthy(`queue-connection-${index}`);
        break;
      } catch (error) {
        attempts++;
        this.logger.error(`Reconnection attempt ${attempts} failed`, { error });
      }
    }
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}