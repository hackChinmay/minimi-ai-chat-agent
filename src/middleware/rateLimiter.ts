import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export interface RateLimitOptions {
  windowMs?: number;
  max?: number;
  message?: string;
  enabled?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export class InMemoryRateLimiter {
  private readonly hits = new Map<string, RateLimitRecord>();
  private readonly windowMs: number;
  private readonly max: number;
  private readonly enabled: boolean;
  private readonly keyGenerator: (req: Request) => string;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options?: RateLimitOptions) {
    this.windowMs = options?.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
    this.max = options?.max ?? env.RATE_LIMIT_MAX_REQUESTS;
    this.enabled = options?.enabled ?? env.RATE_LIMIT_ENABLED;
    this.keyGenerator =
      options?.keyGenerator ??
      ((req: Request) => {
        const forwarded = req.headers['x-forwarded-for'];
        let ip = 'unknown';
        if (typeof forwarded === 'string') {
          const parts = forwarded.split(',');
          ip = parts[0]?.trim() || 'unknown';
        } else {
          ip = req.socket.remoteAddress || 'unknown';
        }
        return ip;
      });

    // Cleanup expired records every 60s without keeping the event loop alive
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => this.cleanup(), 60000);
      if (timer && typeof timer.unref === 'function') {
        timer.unref();
      }
      this.cleanupTimer = timer;
    }
  }

  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  public cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (now > record.resetTime) {
        this.hits.delete(key);
      }
    }
  }

  public reset(): void {
    this.hits.clear();
  }

  public middleware() {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!this.enabled) {
        return next();
      }

      const key = this.keyGenerator(req);
      const now = Date.now();
      let record = this.hits.get(key);

      if (!record || now > record.resetTime) {
        record = {
          count: 1,
          resetTime: now + this.windowMs,
        };
        this.hits.set(key, record);
      } else {
        record.count += 1;
      }

      const remaining = Math.max(0, this.max - record.count);
      const resetInSeconds = Math.ceil((record.resetTime - now) / 1000);

      res.setHeader('X-RateLimit-Limit', this.max.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());

      if (record.count > this.max) {
        res.setHeader('Retry-After', resetInSeconds.toString());
        logger.warn(`Rate limit exceeded for client [${key}]`, {
          ip: key,
          path: req.originalUrl || req.url,
          count: record.count,
          max: this.max,
        });

        res.status(429).json({
          status: 'error',
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfterSeconds: resetInSeconds,
        });
        return;
      }

      next();
    };
  }
}

export const defaultRateLimiter = new InMemoryRateLimiter();
export const rateLimitMiddleware = defaultRateLimiter.middleware();
