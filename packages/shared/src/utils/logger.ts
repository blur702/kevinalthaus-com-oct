import { randomUUID } from 'crypto';

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  service?: string;
  context?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}

export interface Logger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, error?: Error, metadata?: Record<string, unknown>): void;
  child(context: string): Logger;
}

export interface LoggerConfig {
  level: LogLevel;
  service?: string;
  context?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  filePath?: string;
  format?: 'json' | 'text';
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

export class ConsoleLogger implements Logger {
  constructor(private readonly config: LoggerConfig) {}

  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: Error, metadata?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, metadata, error);
  }

  child(context: string): Logger {
    return new ConsoleLogger({
      ...this.config,
      context: this.config.context ? `${this.config.context}:${context}` : context,
    });
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
    error?: Error
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      service: this.config.service,
      context: this.config.context,
      requestId: metadata?.requestId as string | undefined,
      metadata,
      error,
    };

    if (this.config.enableConsole !== false) {
      this.writeToConsole(entry);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.config.level];
  }

  private writeToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const context = entry.context ? `[${entry.context}]` : '';
    const prefix = `${timestamp} ${entry.level.toUpperCase()} ${context}`;

    const logFn = this.getConsoleMethod(entry.level);

    if (this.config.format === 'json') {
      logFn(JSON.stringify(entry));
    } else {
      logFn(`${prefix} ${entry.message}`);

      if (entry.metadata && Object.keys(entry.metadata).length > 0) {
        logFn('  Metadata:', entry.metadata);
      }

      if (entry.error) {
        logFn('  Error:', entry.error.stack || entry.error.message);
      }
    }
  }

  private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
    /* eslint-disable no-console */
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug.bind(console);
      case LogLevel.INFO:
        return console.info.bind(console);
      case LogLevel.WARN:
        return console.warn.bind(console);
      case LogLevel.ERROR:
        return console.error.bind(console);
      default:
        return console.log.bind(console);
    }
    /* eslint-enable no-console */
  }
}

export function createLogger(config: Partial<LoggerConfig> = {}): Logger {
  const defaultConfig: LoggerConfig = {
    level: LogLevel.INFO,
    enableConsole: true,
    format: 'text',
    ...config,
  };

  return new ConsoleLogger(defaultConfig);
}

export const defaultLogger = createLogger();

// Pure utility for generating or extracting request IDs
export function generateOrExtractRequestId(existingId?: string): string {
  return existingId ?? randomUUID();
}
