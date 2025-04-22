import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';

describe('POST /webhook', () => {
  it('should return 202 and Accepted status for valid JSON payload', async () => {
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'application/json')
      .send({ event: 'test', data: { key: 'value' } });

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ status: 'Accepted' });
  });

  it('should return 400 and error message for invalid JSON payload', async () => {
    const res = await request(app)
      .post('/webhook')
      .set('Content-Type', 'text/plain')
      .send('not a json');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid JSON payload' });
  });
});
