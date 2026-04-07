/**
 * Structured Logging Module
 * 
 * Provides production-ready structured logging with:
 * - JSON formatting for log aggregation
 * - Log level filtering (error, warn, info, debug)
 * - Performance tracking
 * - Request/Response tracking
 * - Error context preservation
 * 
 * Usage:
 *   logger.info('User logged in', { userId: '123', email: 'user@example.com' })
 *   logger.error('Database error', error, { query: 'SELECT ...' })
 *   logger.warn('Rate limit approaching', { remaining: 10 })
 */

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

const currentLogLevel: LogLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;

interface LogContext {
  [key: string]: any;
}

interface StructuredLog {
  level: LogLevel;
  timestamp: string;
  message: string;
  context?: LogContext;
  error?: string;
  stack?: string;
  requestId?: string;
  userId?: string;
  duration?: number;
}

/**
 * Format a structured log entry as JSON
 */
function formatLog(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): StructuredLog {
  const log: StructuredLog = {
    level,
    timestamp: new Date().toISOString(),
    message,
  };

  if (context) {
    log.context = context;
  }

  if (error) {
    log.error = error.message;
    log.stack = process.env.NODE_ENV === 'development' ? error.stack : undefined;
  }

  return log;
}

/**
 * Main logger object
 */
export const logger = {
  /**
   * Log an error
   * 
   * @example
   * logger.error('Failed to fetch user', error, { userId: '123' })
   */
  error: (message: string, error?: Error | null, context?: LogContext) => {
    if (LOG_LEVELS.error <= LOG_LEVELS[currentLogLevel]) {
      const log = formatLog('error', message, context, error || undefined);
      console.error(JSON.stringify(log));
    }
  },

  /**
   * Log a warning
   * 
   * @example
   * logger.warn('Rate limit approaching', { remaining: 10, limit: 100 })
   */
  warn: (message: string, context?: LogContext) => {
    if (LOG_LEVELS.warn <= LOG_LEVELS[currentLogLevel]) {
      const log = formatLog('warn', message, context);
      console.warn(JSON.stringify(log));
    }
  },

  /**
   * Log general information
   * 
   * @example
   * logger.info('User logged in', { userId: '123', email: 'user@example.com' })
   */
  info: (message: string, context?: LogContext) => {
    if (LOG_LEVELS.info <= LOG_LEVELS[currentLogLevel]) {
      const log = formatLog('info', message, context);
      console.log(JSON.stringify(log));
    }
  },

  /**
   * Log debug information (only in development)
   * 
   * @example
   * logger.debug('Query execution', { query: 'SELECT ...', time: 45 })
   */
  debug: (message: string, context?: LogContext) => {
    if (LOG_LEVELS.debug <= LOG_LEVELS[currentLogLevel]) {
      const log = formatLog('debug', message, context);
      console.log(JSON.stringify(log));
    }
  },

  /**
   * Log performance metrics
   * 
   * @example
   * logger.performance('API Request', 145, { endpoint: '/api/benefits' })
   */
  performance: (message: string, durationMs: number, context?: LogContext) => {
    const level = durationMs > 1000 ? 'warn' : 'info';
    if (LOG_LEVELS[level] <= LOG_LEVELS[currentLogLevel]) {
      const log = formatLog(level, message, {
        ...context,
        durationMs,
        slow: durationMs > 1000,
      });
      console.log(JSON.stringify(log));
    }
  },

  /**
   * Log API request/response
   * 
   * @example
   * logger.api('GET /api/benefits', 200, 145, { userId: '123' })
   */
  api: (
    method: string,
    statusCode: number,
    durationMs: number,
    context?: LogContext
  ) => {
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    if (LOG_LEVELS[level] <= LOG_LEVELS[currentLogLevel]) {
      const log = formatLog(level, `API ${method}`, {
        ...context,
        statusCode,
        durationMs,
      });
      console.log(JSON.stringify(log));
    }
  },
};

// Export for use in middleware
export type { StructuredLog, LogContext };
