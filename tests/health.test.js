import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';

describe('GET /health', () => {
  it('should return status 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  it('should return the correct response structure', async () => {
    const response = await request(app).get('/health');
    
    // Check that all required keys exist
    expect(response.body).toHaveProperty('status');
    expect(response.body).toHaveProperty('uptime');
    expect(response.body).toHaveProperty('timestamp');
    
    // Check the values
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptime).toBe('number');
    
    // Verify timestamp is a valid date
    const timestamp = new Date(response.body.timestamp);
    expect(timestamp instanceof Date).toBe(true);
    expect(timestamp.toString()).not.toBe('Invalid Date');
  });
});
