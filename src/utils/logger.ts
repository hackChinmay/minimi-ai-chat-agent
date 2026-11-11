import { env } from '../config/env';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  meta?: unknown;
}

class Logger {
  private currentLevel: LogLevel;

  constructor() {
    this.currentLevel = env.LOG_LEVEL;
  }

  public setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.currentLevel];
  }

  private formatMessage(level: LogLevel, message: string, meta?: unknown, requestId?: string): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(requestId ? { requestId } : {}),
      ...(meta !== undefined ? { meta } : {}),
    };

    if (env.NODE_ENV === 'production') {
      return JSON.stringify(entry);
    }

    const reqIdTag = requestId ? ` [req:${requestId}]` : '';
    const metaTag = meta !== undefined ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `[${entry.timestamp}] [${level.toUpperCase()}]${reqIdTag}: ${message}${metaTag}`;
  }

  public debug(message: string, meta?: unknown, requestId?: string): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta, requestId));
    }
  }

  public info(message: string, meta?: unknown, requestId?: string): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta, requestId));
    }
  }

  public warn(message: string, meta?: unknown, requestId?: string): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta, requestId));
    }
  }

  public error(message: string, meta?: unknown, requestId?: string): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta, requestId));
    }
  }
}

export const logger = new Logger();
