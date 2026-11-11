import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  // In test environment, skip normal access logging to reduce test runner noise
  if (env.NODE_ENV === 'test') {
    return next();
  }

  const startTime = req.startTime ?? Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const requestId = req.id;

    const message = `${method} ${url} ${statusCode} - ${duration}ms`;

    if (statusCode >= 500) {
      logger.error(message, { statusCode, duration, method, url }, requestId);
    } else if (statusCode >= 400) {
      logger.warn(message, { statusCode, duration, method, url }, requestId);
    } else {
      logger.info(message, { statusCode, duration, method, url }, requestId);
    }
  });

  next();
}
