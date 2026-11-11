export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_SERVER_ERROR', details?: unknown, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation Failed', details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: unknown) {
    super(message, 403, 'FORBIDDEN', details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource Not Found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Payload Too Large', details?: unknown) {
    super(message, 413, 'PAYLOAD_TOO_LARGE', details);
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', details?: unknown) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

// ============================================================================
// Search Domain Errors
// ============================================================================

export class SearchProviderError extends AppError {
  constructor(message = 'Web search provider failed', details?: unknown) {
    super(message, 502, 'SEARCH_PROVIDER_ERROR', details);
  }
}

export class SearchTimeoutError extends AppError {
  constructor(message = 'Web search request timed out', details?: unknown) {
    super(message, 504, 'SEARCH_TIMEOUT', details);
  }
}

export class SearchRateLimitError extends AppError {
  constructor(message = 'Web search provider rate limit exceeded', details?: unknown) {
    super(message, 429, 'SEARCH_RATE_LIMITED', details);
  }
}

export class SearchAuthenticationError extends AppError {
  constructor(message = 'Web search provider authentication failed', details?: unknown) {
    super(message, 502, 'SEARCH_AUTH_ERROR', details);
  }
}
