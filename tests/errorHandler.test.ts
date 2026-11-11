import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express, { Request, Response } from 'express';
import { errorHandler } from '../src/middleware/errorHandler';
import { requestIdMiddleware } from '../src/middleware/requestId';
import { BadRequestError, ValidationError, ForbiddenError } from '../src/utils/errors';
import { asyncHandler } from '../src/utils/asyncHandler';

function createTestApp() {
  const testApp = express();
  testApp.use(requestIdMiddleware);
  testApp.use(express.json());

  testApp.get('/test/bad-request', () => {
    throw new BadRequestError('Invalid query parameter provided', { param: 'filter' });
  });

  testApp.get('/test/validation-error', () => {
    throw new ValidationError('Validation failed', [{ field: 'email', message: 'Invalid format' }]);
  });

  testApp.get('/test/forbidden', () => {
    throw new ForbiddenError('Access denied to resource');
  });

  testApp.get(
    '/test/async-rejection',
    asyncHandler(async (_req: Request, _res: Response) => {
      throw new Error('Unexpected async failure');
    })
  );

  testApp.get('/test/unhandled-sync', () => {
    throw new Error('Database connection crashed');
  });

  testApp.use(errorHandler);
  return testApp;
}

describe('Centralized Error Handling Middleware', () => {
  const testApp = createTestApp();

  it('should format BadRequestError with 400 status and details', async () => {
    const res = await request(testApp).get('/test/bad-request');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.message).toBe('Invalid query parameter provided');
    expect(res.body.error.details).toEqual({ param: 'filter' });
    expect(res.body.error.requestId).toBeDefined();
  });

  it('should format ValidationError with 400 status and field errors', async () => {
    const res = await request(testApp).get('/test/validation-error');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual([{ field: 'email', message: 'Invalid format' }]);
  });

  it('should format ForbiddenError with 403 status', async () => {
    const res = await request(testApp).get('/test/forbidden');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toBe('Access denied to resource');
  });

  it('should catch async rejections and return 500 without crashing the process', async () => {
    const res = await request(testApp).get('/test/async-rejection');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.error.message).toBe('Unexpected async failure');
  });

  it('should catch malformed JSON body and return 400 INVALID_JSON', async () => {
    const res = await request(testApp)
      .post('/test/bad-request')
      .set('Content-Type', 'application/json')
      .send('{"invalid-json-without-closing-brace":');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect(res.body.error.message).toContain('Malformed JSON payload');
  });
});
