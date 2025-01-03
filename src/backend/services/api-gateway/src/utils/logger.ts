import winston from 'winston'; // ^3.8.0
import DailyRotateFile from 'winston-daily-rotate-file'; // ^4.7.0
import { config } from '../config';

// Define log levels with corresponding priorities
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// Interface for structured log metadata
interface LogMetadata {
  requestId: string;
  userId?: string;
  service: string;
  environment: string;
  timestamp: string;
  correlationId: string;
  traceId: string;
  spanId: string;
  level: string;
  source: string;
}

// Patterns for sensitive data that should be redacted
const SENSITIVE_PATTERNS = [
  /\b\d{16}\b/g, // Credit card numbers
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /password["']?\s*[:=]\s*["']?[^"'\s]+["']?/gi, // Passwords
  /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi, // Bearer tokens
  /authorization:\s*[a-zA-Z0-9\-._~+/]+=*/gi // Authorization headers
];

/**
 * Formats log messages with consistent structure and metadata
 * @param message The log message to format
 * @param metadata Additional contextual metadata
 * @returns Formatted log message with metadata
 */
const formatLogMessage = (message: string, metadata: LogMetadata): string => {
  // Sanitize sensitive data
  let sanitizedMessage = message;
  SENSITIVE_PATTERNS.forEach(pattern => {
    sanitizedMessage = sanitizedMessage.replace(pattern, '[REDACTED]');
  });

  return JSON.stringify({
    message: sanitizedMessage,
    ...metadata,
    timestamp: new Date().toISOString(),
    service: 'api-gateway',
    environment: config.server.env
  });
};

/**
 * Creates and configures Winston logger instance with appropriate transports and formats
 */
const createLogger = () => {
  // Define custom format combining timestamp, metadata, and error stacks
  const customFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.metadata(),
    winston.format.json()
  );

  // Configure file transport with rotation
  const fileTransport = new DailyRotateFile({
    filename: 'logs/api-gateway-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: customFormat
  });

  // Configure console transport with colors for development
  const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
    level: config.monitoring.logLevel
  });

  // Create Winston logger instance
  const logger = winston.createLogger({
    levels: LOG_LEVELS,
    level: config.monitoring.logLevel,
    format: customFormat,
    transports: [
      fileTransport,
      consoleTransport
    ],
    exitOnError: false
  });

  // Handle transport errors
  fileTransport.on('error', (error) => {
    console.error('Error writing to log file:', error);
  });

  // Add monitoring hooks if enabled
  if (config.monitoring.enabled) {
    logger.on('data', (log) => {
      if (log.level === 'error') {
        // Increment error count metric
        // This would be implemented by your monitoring system
      }
    });
  }

  return logger;
};

// Create and configure logger instance
const logger = createLogger();

// Export configured logger with type-safe methods
export const loggerInstance = {
  error: (message: string, metadata: Partial<LogMetadata> = {}) => {
    logger.error(formatLogMessage(message, { ...getDefaultMetadata(), ...metadata } as LogMetadata));
  },
  warn: (message: string, metadata: Partial<LogMetadata> = {}) => {
    logger.warn(formatLogMessage(message, { ...getDefaultMetadata(), ...metadata } as LogMetadata));
  },
  info: (message: string, metadata: Partial<LogMetadata> = {}) => {
    logger.info(formatLogMessage(message, { ...getDefaultMetadata(), ...metadata } as LogMetadata));
  },
  http: (message: string, metadata: Partial<LogMetadata> = {}) => {
    logger.http(formatLogMessage(message, { ...getDefaultMetadata(), ...metadata } as LogMetadata));
  },
  verbose: (message: string, metadata: Partial<LogMetadata> = {}) => {
    logger.verbose(formatLogMessage(message, { ...getDefaultMetadata(), ...metadata } as LogMetadata));
  },
  debug: (message: string, metadata: Partial<LogMetadata> = {}) => {
    logger.debug(formatLogMessage(message, { ...getDefaultMetadata(), ...metadata } as LogMetadata));
  }
};

// Helper function to get default metadata
function getDefaultMetadata(): Partial<LogMetadata> {
  return {
    service: 'api-gateway',
    environment: config.server.env,
    timestamp: new Date().toISOString(),
    correlationId: '', // Should be set by request context
    traceId: '', // Should be set by tracing system
    spanId: '', // Should be set by tracing system
    source: 'api-gateway'
  };
}

// Export default logger instance
export default loggerInstance;