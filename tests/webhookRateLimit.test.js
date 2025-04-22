import { jest, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import config from '../src/config.js';
import app from '../src/server.js';

process.env.OVERLOAD_THRESHOLD = '5';
process.env.CONCURRENCY = '1';

describe('POST /webhook rate limiting', () => {
  it('accepts up to the overload threshold then rejects the next request', async () => {
    // Send requests up to the threshold and expect 202 Accepted
    for (let i = 1; i <= config.OVERLOAD_THRESHOLD; i++) {
      const res = await request(app)
        .post('/webhook')
        .send({ test: `payload-${i}` });
      expect(res.status).toBe(202);
    }

    // The next request should be rate limited
    const overflowRes = await request(app)
      .post('/webhook')
      .send({ test: 'overflow' });
    expect(overflowRes.status).toBe(429);
    expect(overflowRes.body).toEqual({ error: 'Too Many Requests' });

    // Verify that the metrics endpoint records one rate limit event
    const metricsRes = await request(app).get('/metrics');
    expect(metricsRes.status).toBe(200);
    expect(metricsRes.headers['content-type']).toMatch(/text\/plain/);
    expect(metricsRes.text).toMatch(/webhook_too_many_requests\s+1/);
  });
});