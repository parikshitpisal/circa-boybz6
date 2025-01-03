import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import relativeTime from 'dayjs/plugin/relativeTime';

// Version comments for dependencies
// dayjs: ^1.11.9
// dayjs/plugin/utc: ^1.11.9
// dayjs/plugin/relativeTime: ^1.11.9

// Initialize dayjs plugins
dayjs.extend(utc);
dayjs.extend(relativeTime);

// Global constants for date formatting and validation
export const DATE_FORMAT = 'YYYY-MM-DD' as const;
export const TIME_FORMAT = 'HH:mm:ss.SSS' as const;
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss.SSS' as const;
export const TIMEZONE = 'UTC' as const;
export const MAX_PROCESSING_TIME_MS = 300000 as const; // 5 minutes in milliseconds

/**
 * Formats a date into a standardized string with timezone handling
 * @param date - Input date as Date object, timestamp, or date string
 * @param format - Output format string (defaults to DATETIME_FORMAT)
 * @param useUTC - Whether to convert to UTC timezone (defaults to true)
 * @returns Formatted date string
 * @throws Error if date is invalid or formatting fails
 */
export const formatDate = (
  date: Date | string | number,
  format: string = DATETIME_FORMAT,
  useUTC: boolean = true
): string => {
  if (!date) {
    throw new Error('Date parameter is required');
  }

  try {
    let dateObj = dayjs(date);
    if (!dateObj.isValid()) {
      throw new Error('Invalid date provided');
    }

    if (useUTC) {
      dateObj = dateObj.utc();
    }

    return dateObj.format(format);
  } catch (error) {
    throw new Error(`Date formatting failed: ${(error as Error).message}`);
  }
};

/**
 * Parses a date string into a UTC Date object with strict validation
 * @param dateString - Input date string
 * @returns Parsed UTC Date object
 * @throws Error if date string is invalid or parsing fails
 */
export const parseDate = (dateString: string): Date => {
  if (!dateString) {
    throw new Error('Date string is required');
  }

  try {
    const parsed = dayjs.utc(dateString, DATETIME_FORMAT, true);
    if (!parsed.isValid()) {
      throw new Error('Invalid date format');
    }

    return parsed.toDate();
  } catch (error) {
    throw new Error(`Date parsing failed: ${(error as Error).message}`);
  }
};

/**
 * Converts a timestamp to a human-readable relative time string
 * @param date - Input date to compare against current time
 * @param withoutSuffix - Whether to exclude ago/in suffix (defaults to false)
 * @returns Localized relative time string
 * @throws Error if date is invalid or conversion fails
 */
export const getRelativeTime = (
  date: Date | string | number,
  withoutSuffix: boolean = false
): string => {
  if (!date) {
    throw new Error('Date parameter is required');
  }

  try {
    const dateObj = dayjs.utc(date);
    if (!dateObj.isValid()) {
      throw new Error('Invalid date provided');
    }

    return dateObj.fromNow(withoutSuffix);
  } catch (error) {
    throw new Error(`Relative time calculation failed: ${(error as Error).message}`);
  }
};

/**
 * Calculates processing time between two timestamps with millisecond precision
 * @param startTime - Processing start timestamp
 * @param endTime - Processing end timestamp
 * @returns Processing duration in milliseconds
 * @throws Error if timestamps are invalid or calculation fails
 */
export const calculateProcessingTime = (
  startTime: Date | string | number,
  endTime: Date | string | number
): number => {
  if (!startTime || !endTime) {
    throw new Error('Both start and end times are required');
  }

  try {
    const start = dayjs.utc(startTime);
    const end = dayjs.utc(endTime);

    if (!start.isValid() || !end.isValid()) {
      throw new Error('Invalid timestamp provided');
    }

    const duration = end.diff(start);

    if (duration < 0) {
      throw new Error('End time cannot be before start time');
    }

    if (duration > MAX_PROCESSING_TIME_MS) {
      throw new Error(`Processing time exceeds maximum allowed duration of ${MAX_PROCESSING_TIME_MS}ms`);
    }

    return duration;
  } catch (error) {
    throw new Error(`Processing time calculation failed: ${(error as Error).message}`);
  }
};

/**
 * Validates a date value and optionally checks format compliance
 * @param date - Date value to validate
 * @param format - Optional format string to validate against
 * @returns Boolean indicating whether the date is valid
 */
export const isValidDate = (date: any, format?: string): boolean => {
  if (!date) {
    return false;
  }

  try {
    const dateObj = format 
      ? dayjs(date, format, true)
      : dayjs(date);

    return dateObj.isValid() && (
      !format || dateObj.format(format) === date
    );
  } catch {
    return false;
  }
};