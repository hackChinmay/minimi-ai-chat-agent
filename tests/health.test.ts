import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('GET /api/health', () => {
  it('should return 200 OK with expected health payload and headers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.headers['x-request-id']).toBeDefined();
    expect(typeof res.headers['x-request-id']).toBe('string');
    expect(res.headers['x-request-id'].length).toBeGreaterThan(0);

    // Standard API response contract
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');

    const data = res.body.data;
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('version');
    expect(typeof data.version).toBe('string');
    expect(data).toHaveProperty('environment');
    expect(data).toHaveProperty('uptime');
    expect(typeof data.uptime).toBe('number');
    expect(data.uptime).toBeGreaterThanOrEqual(0);
    expect(data).toHaveProperty('timestamp');
    expect(new Date(data.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('should preserve incoming X-Request-Id header when provided', async () => {
    const customReqId = 'custom-client-trace-12345';
    const res = await request(app)
      .get('/api/health')
      .set('X-Request-Id', customReqId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(customReqId);
  });
});
