import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Not Found (404) Route Handling', () => {
  it('should return 404 for an unregistered GET route', async () => {
    const res = await request(app).get('/api/unregistered-endpoint');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');

    const error = res.body.error;
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toContain('Cannot GET /api/unregistered-endpoint');
    expect(error.requestId).toBeDefined();
    expect(error.timestamp).toBeDefined();
  });

  it('should return 404 for an unregistered POST route at root', async () => {
    const res = await request(app).post('/random-root-path').send({ foo: 'bar' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('Cannot POST /random-root-path');
  });
});
