import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app from '../src/server.js';

describe('GET /metrics', () => {
  it('should return 200, content-type text/plain, and include webhook_total_received', async () => {
    const res = await request(app).get('/metrics');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('webhook_total_received');
  });

  it('should include all webhook metrics after processing requests', async () => {
    // Send a batch of webhook requests to generate metrics
    const webhookPayload = { event: 'test_event', data: { test: 'data' } };
    
    // Send 5 webhook requests to ensure metrics are generated
    const requests = [];
    for (let i = 0; i < 5; i++) {
      requests.push(
        request(app)
          .post('/webhook')
          .send(webhookPayload)
          .set('Content-Type', 'application/json')
      );
    }
    
    // Wait for all webhook requests to complete
    await Promise.all(requests);
    
    // Wait a short time to allow metrics to be updated
    // This is necessary because some metrics might be updated asynchronously
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get the metrics after sending webhook requests
    const metricsRes = await request(app).get('/metrics');
    
    // Verify all required metrics are present
    expect(metricsRes.status).toBe(200);
    expect(metricsRes.headers['content-type']).toMatch(/text\/plain/);
    
    // Check for all required metric names
    const requiredMetrics = [
      'webhook_total_received',
      'webhook_total_processed',
      'webhook_queue_length',
      'webhook_too_many_requests',
      'webhook_processing_time_ms',
      'webhook_queue_time_ms'
    ];
    
    for (const metricName of requiredMetrics) {
      expect(metricsRes.text).toContain(metricName);
    }
  });
});
