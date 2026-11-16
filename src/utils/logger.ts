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

const SENSITIVE_KEY_REGEX = /^(api[_-]?key|authorization|bearer|password|secret|token|cookie|access[_-]?token|private[_-]?key|refresh[_-]?token)$/i;

/**
 * Redacts secrets from strings (e.g. Bearer tokens, OpenAI keys, Tavily keys).
 */
export function redactString(str: string): string {
  let redacted = str;

  // Bearer tokens
  redacted = redacted.replace(/Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');

  // OpenAI keys
  redacted = redacted.replace(/sk-[a-zA-Z0-9_-]{16,}/g, (match) => {
    return `${match.slice(0, 4)}...[REDACTED]`;
  });

  // Tavily keys
  redacted = redacted.replace(/tvly-[a-zA-Z0-9_-]{16,}/g, (match) => {
    return `${match.slice(0, 4)}...[REDACTED]`;
  });

  return redacted;
}

/**
 * Recursively sanitizes any value, masking known sensitive keys and secret patterns.
 */
export function sanitizeMeta(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'function' || typeof value === 'symbol') {
    return '[Not Serializable]';
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: env.NODE_ENV === 'production' ? undefined : (value.stack ? redactString(value.stack) : undefined),
    };
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[Circular Reference]';
    }
    seen.add(value);

    if (Array.isArray(value)) {
      return value.map((item) => sanitizeMeta(item, seen));
    }

    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeMeta(val, seen);
      }
    }
    return sanitizedObj;
  }

  return value;
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
    const cleanMessage = redactString(message);
    const cleanMeta = meta !== undefined ? sanitizeMeta(meta) : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: cleanMessage,
      ...(requestId ? { requestId } : {}),
      ...(cleanMeta !== undefined ? { meta: cleanMeta } : {}),
    };

    if (env.NODE_ENV === 'production') {
      return JSON.stringify(entry);
    }

    const reqIdTag = requestId ? ` [req:${requestId}]` : '';
    const metaTag = cleanMeta !== undefined ? `\n${JSON.stringify(cleanMeta, null, 2)}` : '';
    return `[${entry.timestamp}] [${level.toUpperCase()}]${reqIdTag}: ${cleanMessage}${metaTag}`;
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
