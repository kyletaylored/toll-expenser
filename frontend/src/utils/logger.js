/**
 * Logger Utility
 *
 * Provides controlled logging that respects environment settings.
 * In production, sensitive data is never logged.
 * In development, logging can be controlled via environment variables.
 */

const isDevelopment = import.meta.env.DEV;
const isProduction = import.meta.env.PROD;

// Check if verbose logging is enabled
const isVerbose = import.meta.env.VITE_VERBOSE_LOGS === 'true';

/**
 * Sanitize data before logging to remove sensitive information
 */
function sanitize(data) {
  if (!data) return data;

  // If it's a string, check for common sensitive patterns
  if (typeof data === 'string') {
    // Mask tokens (anything that looks like a JWT or long alphanumeric string)
    if (data.length > 50 && /^[A-Za-z0-9_-]+$/.test(data)) {
      return `${data.substring(0, 10)}...${data.substring(data.length - 5)}`;
    }
    return data;
  }

  // If it's an object, sanitize sensitive keys
  if (typeof data === 'object' && data !== null) {
    const sanitized = Array.isArray(data) ? [...data] : { ...data };
    const sensitiveKeys = [
      'accessToken',
      'token',
      'password',
      'secret',
      'authorization',
      'credit_card',
      'ssn',
      'api_key',
    ];

    for (const key in sanitized) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = sanitize(sanitized[key]);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Logger class with environment-aware methods
 */
class Logger {
  constructor(namespace = '') {
    this.namespace = namespace;
  }

  /**
   * Create a child logger with a namespace
   */
  child(namespace) {
    return new Logger(this.namespace ? `${this.namespace}:${namespace}` : namespace);
  }

  /**
   * Format log message with namespace
   */
  _format(...args) {
    if (this.namespace) {
      return [`[${this.namespace}]`, ...args];
    }
    return args;
  }

  /**
   * Log general information (development only, sanitized)
   */
  log(...args) {
    if (isDevelopment && isVerbose) {
      console.log(...this._format(...args.map(sanitize)));
    }
  }

  /**
   * Log debug information (development only, sanitized)
   */
  debug(...args) {
    if (isDevelopment && isVerbose) {
      console.debug(...this._format(...args.map(sanitize)));
    }
  }

  /**
   * Log informational messages (development only, sanitized)
   */
  info(...args) {
    if (isDevelopment) {
      console.info(...this._format(...args.map(sanitize)));
    }
  }

  /**
   * Log warnings (always shown, sanitized)
   */
  warn(...args) {
    console.warn(...this._format(...args.map(sanitize)));
  }

  /**
   * Log errors (always shown, sanitized)
   */
  error(...args) {
    // In production, don't log full error details
    if (isProduction) {
      const sanitizedArgs = args.map(arg => {
        if (arg instanceof Error) {
          return `Error: ${arg.message}`;
        }
        return sanitize(arg);
      });
      console.error(...this._format(...sanitizedArgs));
    } else {
      console.error(...this._format(...args.map(sanitize)));
    }
  }

  /**
   * Group logs together (development only)
   */
  group(label) {
    if (isDevelopment && isVerbose) {
      console.group(...this._format(label));
    }
  }

  /**
   * End a log group (development only)
   */
  groupEnd() {
    if (isDevelopment && isVerbose) {
      console.groupEnd();
    }
  }

  /**
   * Log a table (development only)
   */
  table(data) {
    if (isDevelopment && isVerbose) {
      console.table(sanitize(data));
    }
  }

  /**
   * Time operations (development only)
   */
  time(label) {
    if (isDevelopment && isVerbose) {
      console.time(...this._format(label));
    }
  }

  /**
   * End timing operations (development only)
   */
  timeEnd(label) {
    if (isDevelopment && isVerbose) {
      console.timeEnd(...this._format(label));
    }
  }
}

// Create and export default logger instance
export const logger = new Logger();

// Export logger class for creating namespaced loggers
export default logger;
