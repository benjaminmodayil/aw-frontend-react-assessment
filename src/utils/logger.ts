// Simple logging utility for development and debugging
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.level = this.isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.isDevelopment && level >= this.level;
  }

  private sanitizeContext(context: any): any {
    if (!context) return undefined;
    
    // Remove sensitive data from context
    const sanitized = { ...context };
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'auth', 'cookie', 'session'];
    
    for (const key in sanitized) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private formatMessage(level: string, message: string, context?: any): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    const sanitizedContext = this.sanitizeContext(context);
    return sanitizedContext ? `${prefix} ${message} ${JSON.stringify(sanitizedContext)}` : `${prefix} ${message}`;
  }

  debug(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage('DEBUG', message, context));
    }
  }

  info(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message, context));
    }
  }

  warn(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  error(message: string, context?: any): void {
    // In production, only log generic error messages
    if (!this.isDevelopment) {
      console.error('An error occurred. Please try again later.');
      return;
    }
    
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, context));
    }
  }
}

export const logger = new Logger();