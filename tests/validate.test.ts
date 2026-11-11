import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { validateRequest } from '../src/middleware/validate';
import { errorHandler } from '../src/middleware/errorHandler';

const querySchema = z.object({
  page: z.coerce.number().int().positive(),
});

const bodySchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
});

const paramsSchema = z.object({
  id: z.string().uuid(),
});

function createValidationTestApp() {
  const testApp = express();
  testApp.use(express.json());

  testApp.post(
    '/test/:id',
    validateRequest({
      params: paramsSchema,
      query: querySchema,
      body: bodySchema,
    }),
    (req, res) => {
      res.status(200).json({ success: true, data: { params: req.params, query: req.query, body: req.body } });
    }
  );

  testApp.use(errorHandler);
  return testApp;
}

describe('Request Validation Middleware (validateRequest)', () => {
  const app = createValidationTestApp();
  const validUuid = '123e4567-e89b-12d3-a456-426614174000';

  it('should pass validation when params, query, and body meet schema requirements', async () => {
    const res = await request(app)
      .post(`/test/${validUuid}?page=1`)
      .send({ name: 'Alex', email: 'alex@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.body.name).toBe('Alex');
    expect(res.body.data.query.page).toBe(1);
    expect(res.body.data.params.id).toBe(validUuid);
  });

  it('should return 400 VALIDATION_ERROR when body is invalid', async () => {
    const res = await request(app)
      .post(`/test/${validUuid}?page=1`)
      .send({ name: 'A', email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toBeInstanceOf(Array);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('should return 400 VALIDATION_ERROR when query param is invalid', async () => {
    const res = await request(app)
      .post(`/test/${validUuid}?page=-5`)
      .send({ name: 'Alex', email: 'alex@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 VALIDATION_ERROR when path param is invalid UUID', async () => {
    const res = await request(app)
      .post('/test/invalid-uuid?page=1')
      .send({ name: 'Alex', email: 'alex@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
