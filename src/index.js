import http from 'http';
import config from './config.js';
import app from './server.js';
import { createWebhookQueue } from './services/queue.js';
import * as defaultMetrics from './utils/metrics.js';
import { processWithRetry } from './services/processor.js';
import WorkerPool from './services/workerPool.js';
import { logger } from './utils/logger.js';

// Create a webhook queue instance using the factory
const webhookQueue = createWebhookQueue({ 
  processor: processWithRetry, 
  metrics: defaultMetrics, 
  concurrency: config.CONCURRENCY, 
  threshold: config.OVERLOAD_THRESHOLD 
});

// Initialize the worker pool with our queue
const workerPool = new WorkerPool(webhookQueue);
workerPool.start();

// Create and start the HTTP server
const server = http.createServer(app);
server.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'HTTP server listening');
});

// Log and exit on server errors
server.on('error', (err) => {
  logger.error({ err }, 'HTTP server encountered an error');
  process.exit(1);
});

// Graceful shutdown handler
const gracefulShutdown = () => {
  logger.info('Shutdown signal received, closing HTTP server');
  
  // First convert server.close to a promise to make the flow cleaner
  const closeServer = () => {
    return new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };
  
  // Now handle the whole shutdown sequence in one async flow
  (async () => {
    try {
      await closeServer();
      logger.info('HTTP server closed, stopping worker pool');
      
      await workerPool.stop();
      logger.info('Worker pool stopped, awaiting queue drain');
      
      await webhookQueue.drain();
      
      // All previous awaits have resolved
      // Use console.log directly to bypass Pino buffering
      console.log('All queued items processed, exiting now');
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  })();
};



// Capture termination signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
