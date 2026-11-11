import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { ApiResponse, ApiErrorPayload } from '../types';

export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  // Express requires 4 arguments to recognize an error-handling middleware
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const requestId = req.id;
  const timestamp = new Date().toISOString();

  // Handle known AppErrors
  if (err instanceof AppError) {
    const errorPayload: ApiErrorPayload = {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
      ...(requestId ? { requestId } : {}),
      timestamp,
    };

    if (err.statusCode >= 500) {
      logger.error(`Operational error: ${err.message}`, { code: err.code, details: err.details }, requestId);
    } else {
      logger.warn(`Client error [${err.statusCode}]: ${err.message}`, { code: err.code, details: err.details }, requestId);
    }

    const response: ApiResponse = {
      success: false,
      error: errorPayload,
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle malformed JSON body from Express body-parser
  if ('type' in err && (err as { type?: string }).type === 'entity.parse.failed') {
    const errorPayload: ApiErrorPayload = {
      code: 'INVALID_JSON',
      message: 'Malformed JSON payload in request body',
      ...(requestId ? { requestId } : {}),
      timestamp,
    };

    logger.warn('Malformed JSON request received', undefined, requestId);

    const response: ApiResponse = {
      success: false,
      error: errorPayload,
    };

    res.status(400).json(response);
    return;
  }

  // Handle payload too large
  if ('type' in err && (err as { type?: string }).type === 'entity.too.large') {
    const errorPayload: ApiErrorPayload = {
      code: 'PAYLOAD_TOO_LARGE',
      message: `Request entity exceeds configured size limit of ${env.REQUEST_BODY_LIMIT}`,
      ...(requestId ? { requestId } : {}),
      timestamp,
    };

    logger.warn('Payload too large received', undefined, requestId);

    const response: ApiResponse = {
      success: false,
      error: errorPayload,
    };

    res.status(413).json(response);
    return;
  }

  // Unhandled / unexpected internal errors
  logger.error(`Unhandled exception: ${err.message}`, { stack: err.stack }, requestId);

  const isProduction = env.NODE_ENV === 'production';
  const errorPayload: ApiErrorPayload = {
    code: 'INTERNAL_SERVER_ERROR',
    message: isProduction ? 'An unexpected internal server error occurred' : err.message,
    ...(!isProduction && err.stack ? { details: { stack: err.stack.split('\n').map((l) => l.trim()) } } : {}),
    ...(requestId ? { requestId } : {}),
    timestamp,
  };

  const response: ApiResponse = {
    success: false,
    error: errorPayload,
  };

  res.status(500).json(response);
};
