import config from '../config.js';
import { logger } from '../utils/logger.js';
import { WebhookQueue } from './queue.js';

/**
 * Simple sleep utility
 * @param {number} ms - Time to sleep in milliseconds
 * @returns {Promise<void>} Promise that resolves after the specified time
 */
const sleep = (ms) => new Promise((resolve) => {
  const t = setTimeout(resolve, ms);
  return t;
});

/**
 * WorkerPool provides an alternative processing mechanism for WebhookQueue
 * Note: This is optional as WebhookQueue now handles its own processing
 */
class WorkerPool {
  /**
   * @param {WebhookQueue} queue - The queue to process items from
   * @param {Object} options - Configuration options
   * @param {number} [options.concurrency=config.CONCURRENCY] - Number of concurrent workers
   * @param {boolean} [options.disableQueueProcessing=true] - Whether to disable queue's built-in processing
   */
  constructor(queue, { 
    concurrency = config.CONCURRENCY,
    disableQueueProcessing = true
  } = {}) {
    if (!(queue instanceof WebhookQueue)) {
      throw new Error('queue must be an instance of WebhookQueue');
    }

    this.queue = queue;
    this.concurrency = concurrency;
    this.workers = [];
    this.running = false;
    
    // Option to disable queue's built-in processing to avoid duplication
    if (disableQueueProcessing) {
      // Store original method to restore later if needed
      this._originalProcessNext = this.queue.processNext;
      this.queue.processNext = () => {}; // No-op to disable built-in processing
      logger.info('Disabled queue\'s built-in processing in favor of WorkerPool');
    }
  }

  /**
   * Starts the worker pool
   */
  start() {
    if (this.running) {
      logger.warn('Worker pool is already running');
      return;
    }
    
    this.running = true;
    logger.info({ concurrency: this.concurrency }, 'Starting worker pool');
    
    for (let i = 0; i < this.concurrency; i++) {
      this.workers.push(this.workerLoop());
    }
  }

  /**
   * Worker loop that continually dequeues and processes items
   * This runs in a loop until the worker pool is stopped
   * @returns {Promise<void>}
   * Note: Metrics are now handled by the queue itself
   */
  async workerLoop() {
    while (this.running) {
      const item = this.queue.dequeue();

      if (item == null) {
        // Use a fixed polling interval since it's not defined in config
        await sleep(100);
        continue;
      }

      try {
        // The queue's dequeue method already records metrics for queue time
        // Let the queue handle processing and metrics
        await this.queue.processItem(item);
      } catch (error) {
        logger.error({ error: error.message }, 'Error processing item in worker');
      }
    }
  }

  /**
   * Stops all workers and waits for them to finish
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this.running) {
      return;
    }
    
    logger.info('Stopping worker pool');
    this.running = false;
    await Promise.all(this.workers);
    this.workers = [];
    
    // Restore queue's original processing if we disabled it
    if (this._originalProcessNext) {
      this.queue.processNext = this._originalProcessNext;
      logger.info('Restored queue\'s built-in processing');
    }
  }
}

export default WorkerPool;
