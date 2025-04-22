import { jest, describe, it, expect } from '@jest/globals';
import { spawn } from 'child_process';
import http from 'http';

// Set timeout for the entire test suite
jest.setTimeout(20000);

describe('Graceful Shutdown Integration Test', () => {
  const TEST_PORT = 3001;
  const STARTUP_TIMEOUT = 2000;
  const SHUTDOWN_LOG = 'All queued items processed, exiting now';

  it('should process all queued webhooks and exit with code 0 upon SIGINT', async () => {
    // Spawn the application
    const env = { ...process.env, PORT: TEST_PORT, NODE_ENV: 'test', PROCESSING_TIME_MS: '200' };
    const child = spawn('node', ['src/index.js'], { env, cwd: process.cwd() });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    // Wait for server to start
    await new Promise((resolve) => setTimeout(resolve, STARTUP_TIMEOUT));

    // Helper to send a POST /webhook
    const sendWebhook = () => {
      return new Promise((resolve, reject) => {
        const data = JSON.stringify({ test: 'payload' });
        const req = http.request(
          {
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/webhook',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(data)
            }
          },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => resolve(res.statusCode));
          }
        );
        req.on('error', reject);
        req.write(data);
        req.end();
      });
    };

    // Send several webhook requests to occupy the queue
    const results = [];
    for (let i = 0; i < 3; i++) {
      // small delay between requests
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 100));
      // eslint-disable-next-line no-await-in-loop
      results.push(await sendWebhook());
    }
    // All requests should be accepted
    expect(results).toEqual([202, 202, 202]);

    // Send SIGINT to trigger graceful shutdown
    child.kill('SIGINT');

    // Wait for the child process to exit and assert exit code
    const exitCode = await new Promise((resolve) => {
      child.on('close', (code) => {
        resolve(code);
      });
    });

    expect(exitCode).toBe(0);
    // Verify graceful shutdown log appeared
    expect(stdoutData).toContain(SHUTDOWN_LOG);
  });
});
