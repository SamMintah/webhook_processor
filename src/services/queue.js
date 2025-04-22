import { CONCURRENCY, OVERLOAD_THRESHOLD } from '../config.js';
import { setQueueLength, observeQueueTime, incReceived, incProcessed, incTooMany, observeProcessingTime } from '../utils/metrics.js';
import { logger } from '../utils/logger.js';
import { processWithRetry } from './processor.js';


export class QueueOverloadedError extends Error {
  constructor() {
    super('Queue overloaded');
    this.name = 'QueueOverloadedError';
  }
}

/**
 * Queue implementation for webhook processing
 */
class WebhookQueue {
  constructor({ processor, metrics, concurrency = CONCURRENCY, threshold = OVERLOAD_THRESHOLD }) {
    this.queue = [];
    this.processing = new Set();
    this.concurrency = concurrency;
    this.threshold = threshold;
    this.processor = processor;
    this.metrics = metrics;
  }

  /**
 * Enqueue an item for processing. Rejects if the queue is overloaded.
 * @param {any} item - The item to enqueue
 * @returns {Promise<void>}
 */
async enqueue(item) {
  this.metrics.incReceived();
  
  // Check the queue size including the new item to be added
// queue.js, around line 44
if (this.queue.length + this.processing.size + 1 >= this.threshold) {
  logger.warn({ 
    queueLength: this.queue.length, 
    processingSize: this.processing.size,
    threshold: this.threshold,
    item
  }, 'Queue overload, request rejected');
  this.metrics.incTooMany();
  throw new QueueOverloadedError(); // Use the custom error class
}
  
  this.queue.push({ item, enqueuedAt: Date.now() });

  this.metrics.setQueueLength(this.totalItems());
  logger.info({ queueLength: this.queue.length, item }, 'Enqueued item');
  
  // Schedule processing with the new helper method
  this._scheduleProcessing();
}

  /**
   * Dequeue an item from the queue
   * @returns {any} The dequeued item or null if queue is empty
   */
  dequeue() {
    if (this.queue.length === 0) {
      return null;
    }

    const entry = this.queue.shift();
    const delta = Date.now() - entry.enqueuedAt;
    
    this.metrics.observeQueueTime(delta);
    this.metrics.setQueueLength(this.totalItems());
    
    logger.debug({ 
      queueLength: this.queue.length, 
      queueTimeMs: delta,
      item: entry.item
    }, 'Dequeued item');
    
    return entry.item;
  }

  /**
   * Schedule processing of queued items up to concurrency limit
   * @private
   */
  _scheduleProcessing() {
    while (this.processing.size < this.concurrency && this.queue.length > 0) {
      const item = this.dequeue();
      const id = Date.now() + Math.random();
      this.processing.add(id);
      this.metrics.setQueueLength(this.totalItems());
      this.processItem(item)
        .catch(() => {})
        .finally(() => {
          this.processing.delete(id);
          this.metrics.setQueueLength(this.totalItems());
          this._scheduleProcessing();
        });
    }
  }

  /**
   * Process the next item in the queue if under concurrency limit
   * @returns {Promise<void>}
   * @deprecated Use _scheduleProcessing instead
   */
  async processNext() {
    // For backward compatibility, just call the new scheduling method
    this._scheduleProcessing();
  }

  /**
   * Get the current size of the queue
   * @returns {number} The queue size
   */
  size() {
    return this.queue.length + this.processing.size;
  }

  /**
   * Get the total number of items (queued + processing)
   * @returns {number} Total items
   */
  totalItems() {
    return this.queue.length + this.processing.size;
  }

  /**
   * Returns a promise that resolves when the queue is empty and all processing is complete
   * @returns {Promise<void>}
   */
  async drain() {
    // If there's nothing to process, resolve immediately
    if (this.queue.length === 0 && this.processing.size === 0) {
      return Promise.resolve();
    }
    
    // Otherwise, wait for the queue to be fully processed
    return new Promise((resolve) => {
      const checkQueue = setInterval(() => {
        if (this.queue.length === 0 && this.processing.size === 0) {
          clearInterval(checkQueue);
          resolve();
        }
      }, 100); // Check every 100ms
    });
  }

  /**
   * Process a single item
   * @param {any} item - The item to process
   * @returns {Promise<void>}
   */
  async processItem(item) {
    const startTime = Date.now();
    try {
      // Call the processor function with the item
      await this.processor(item);
      
      const processingTime = Date.now() - startTime;
      this.metrics.incProcessed();
      this.metrics.observeProcessingTime(processingTime);
      
      logger.info({ item, processingTime }, 'Processed item successfully');
    } catch (error) {
      logger.error({ item, error: error.message }, 'Error processing item');
      throw error;
    }
  }

  /**
   * Graceful shutdown - process remaining items and log completion
   */
  async shutdown() {
    logger.info({ 
      queueLength: this.queue.length, 
      processingSize: this.processing.size 
    }, 'Starting graceful shutdown of queue');
    
    await this.drain();
    
    logger.info('All queued items processed, queue shutdown complete');
  }
}

export function createWebhookQueue({ processor, metrics, concurrency = CONCURRENCY, threshold = OVERLOAD_THRESHOLD }) {
  return new WebhookQueue({ processor, metrics, concurrency, threshold });
}

const defaultQueue = createWebhookQueue({ 
  processor: processWithRetry, 
  metrics: { 
    incReceived, 
    incProcessed, 
    incTooMany, 
    setQueueLength, 
    observeQueueTime, 
    observeProcessingTime 
  } 
});

export { WebhookQueue };
export default defaultQueue;
