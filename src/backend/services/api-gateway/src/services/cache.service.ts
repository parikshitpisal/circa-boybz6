import { injectable } from 'inversify';
import Redis, { Cluster, ClusterNode, ClusterOptions } from 'ioredis'; // ^5.0.0
import { Logger } from 'winston'; // ^3.8.0
import { EventEmitter } from 'events';
import { config } from '../config';
import crypto from 'crypto';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface CacheOptions {
  ttl?: number;
  prefix?: string;
  encryption?: boolean;
  compression?: boolean;
  namespace?: string;
}

interface RateLimitInfo {
  count: number;
  limit: number;
  reset: number;
  remaining: number;
  retryAfter: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  latency: number;
  memoryUsage: number;
  connectionCount: number;
}

@injectable()
export class CacheService {
  private readonly client: Redis | Cluster;
  private readonly logger: Logger;
  private readonly connectionPool: Map<string, number>;
  private readonly eventEmitter: EventEmitter;
  private readonly metrics: CacheMetrics;
  private readonly encryptionKey: Buffer;

  constructor() {
    this.metrics = {
      hits: 0,
      misses: 0,
      latency: 0,
      memoryUsage: 0,
      connectionCount: 0
    };

    this.connectionPool = new Map();
    this.eventEmitter = new EventEmitter();
    this.encryptionKey = Buffer.from(config.security.encryptionKey, 'hex');

    // Initialize Redis client with cluster support
    if (config.cache.clusterMode) {
      const clusterOptions: ClusterOptions = {
        redisOptions: {
          password: config.cache.password,
          keyPrefix: config.cache.keyPrefix,
          maxRetriesPerRequest: 3,
        },
        clusterRetryStrategy: (times: number) => Math.min(times * 100, 3000),
      };

      this.client = new Redis.Cluster(
        [{ host: config.cache.host, port: config.cache.port }],
        clusterOptions
      );
    } else {
      this.client = new Redis({
        host: config.cache.host,
        port: config.cache.port,
        password: config.cache.password,
        keyPrefix: config.cache.keyPrefix,
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
      });
    }

    // Setup event handlers
    this.setupEventHandlers();
    
    // Initialize health monitoring
    this.startHealthCheck();
  }

  private setupEventHandlers(): void {
    this.client.on('error', (error) => {
      this.logger.error('Redis error:', error);
      this.eventEmitter.emit('cacheError', error);
    });

    this.client.on('connect', () => {
      this.logger.info('Redis connected');
      this.metrics.connectionCount++;
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.metrics.connectionCount--;
    });
  }

  private startHealthCheck(): void {
    setInterval(async () => {
      try {
        const start = Date.now();
        await this.client.ping();
        this.metrics.latency = Date.now() - start;

        const memory = await this.client.info('memory');
        this.metrics.memoryUsage = parseInt(memory.split('\r\n')
          .find(line => line.startsWith('used_memory:'))
          ?.split(':')[1] || '0', 10);
      } catch (error) {
        this.logger.error('Health check failed:', error);
      }
    }, 30000);
  }

  private async encrypt(data: any): Promise<Buffer> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(data), 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private async decrypt(data: Buffer): Promise<any> {
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(16, 32);
    const encrypted = data.subarray(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    return JSON.parse(decrypted.toString('utf8'));
  }

  public async set(key: string, value: any, options: CacheOptions = {}): Promise<void> {
    const start = Date.now();
    try {
      let processedValue = value;
      const finalKey = options.namespace ? `${options.namespace}:${key}` : key;
      
      if (options.encryption) {
        processedValue = await this.encrypt(value);
      }

      if (options.compression) {
        processedValue = await gzip(
          options.encryption ? processedValue : JSON.stringify(value)
        );
      }

      const ttl = options.ttl || config.cache.ttl;
      await this.client.setex(
        finalKey,
        ttl,
        options.compression || options.encryption
          ? processedValue.toString('base64')
          : JSON.stringify(value)
      );

      this.metrics.latency = Date.now() - start;
    } catch (error) {
      this.logger.error('Cache set error:', error);
      throw error;
    }
  }

  public async get(key: string, options: CacheOptions = {}): Promise<any> {
    const start = Date.now();
    try {
      const finalKey = options.namespace ? `${options.namespace}:${key}` : key;
      let value = await this.client.get(finalKey);

      if (!value) {
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;

      if (options.compression || options.encryption) {
        value = Buffer.from(value, 'base64');
      }

      if (options.compression) {
        value = (await gunzip(value)).toString('utf8');
      }

      if (options.encryption) {
        value = await this.decrypt(
          options.compression ? Buffer.from(value) : value
        );
      }

      this.metrics.latency = Date.now() - start;
      return options.encryption ? value : JSON.parse(value);
    } catch (error) {
      this.logger.error('Cache get error:', error);
      throw error;
    }
  }

  public async getRateLimitInfo(key: string, options: {
    limit: number;
    window: number;
  }): Promise<RateLimitInfo> {
    const now = Date.now();
    const windowKey = `ratelimit:${key}:${Math.floor(now / (options.window * 1000))}`;

    const count = await this.client.incr(windowKey);
    if (count === 1) {
      await this.client.expire(windowKey, options.window);
    }

    const ttl = await this.client.ttl(windowKey);
    const reset = now + (ttl * 1000);
    const remaining = Math.max(0, options.limit - count);

    return {
      count,
      limit: options.limit,
      reset,
      remaining,
      retryAfter: remaining > 0 ? 0 : Math.ceil(ttl)
    };
  }

  public async getMetrics(): Promise<CacheMetrics> {
    return { ...this.metrics };
  }

  public async del(key: string, options: CacheOptions = {}): Promise<void> {
    const finalKey = options.namespace ? `${options.namespace}:${key}` : key;
    await this.client.del(finalKey);
  }

  public async flush(): Promise<void> {
    await this.client.flushall();
    this.metrics.hits = 0;
    this.metrics.misses = 0;
  }
}

export default CacheService;