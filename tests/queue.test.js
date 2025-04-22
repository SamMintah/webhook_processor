import { expect, jest, describe, test } from '@jest/globals';
import { WebhookQueue, QueueOverloadedError } from '../src/services/queue.js';
import { CONCURRENCY, OVERLOAD_THRESHOLD } from '../src/config.js';

describe('WebhookQueue', () => {
  test('enqueues and processes items successfully', async () => {
    return jest.isolateModules(async () => {
      jest.resetModules();
      jest.mock('../src/config.js', () => ({
        CONCURRENCY: 1,
        OVERLOAD_THRESHOLD: 5
      }));
  
      const incReceived = jest.fn();
      const incProcessed = jest.fn();
      const incTooMany = jest.fn();
      const setQueueLength = jest.fn();
      const observeProcessingTime = jest.fn();
      const observeQueueTime = jest.fn();
      jest.mock('../src/utils/metrics.js', () => ({
        incReceived,
        incProcessed,
        incTooMany,
        setQueueLength,
        observeProcessingTime,
        observeQueueTime
      }));
  
      jest.mock('../src/utils/logger.js', () => ({
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn()
        }
      }));
  
      const processWithRetry = jest.fn(
        () => new Promise((res) => setTimeout(res, 10))
      );
      jest.mock('../src/services/processor.js', () => ({ processWithRetry }));
  
      const queue = new WebhookQueue({
        processor: processWithRetry,
        metrics: {
          incReceived,
          incProcessed,
          incTooMany,
          setQueueLength,
          observeQueueTime,
          observeProcessingTime
        },
        concurrency: 1,
        threshold: 5
      });
  
      await queue.enqueue('item1');
      expect(incReceived).toHaveBeenCalledTimes(1);
      await queue.enqueue('item2');
      await queue.drain();
  
      expect(incReceived).toHaveBeenCalledTimes(2);
      expect(incProcessed).toHaveBeenCalledTimes(2);
      expect(observeProcessingTime).toHaveBeenCalledTimes(2);
      expect(setQueueLength).toHaveBeenCalled();
      expect(processWithRetry).toHaveBeenCalledTimes(2);
    });
  });

  test('rejects enqueue when overloaded', async () => {
    return jest.isolateModules(async () => {
      jest.resetModules();
  
      // Mock configuration
      jest.mock('../src/config.js', () => ({
        CONCURRENCY: 1,
        OVERLOAD_THRESHOLD: 1
      }));
  
      // Mock metrics
      const incReceived = jest.fn();
      const incProcessed = jest.fn();
      const incTooMany = jest.fn();
      const setQueueLength = jest.fn();
      const observeProcessingTime = jest.fn();
      const observeQueueTime = jest.fn();
      jest.mock('../src/utils/metrics.js', () => ({
        incReceived,
        incProcessed,
        incTooMany,
        setQueueLength,
        observeProcessingTime,
        observeQueueTime
      }));
  
      // Mock logger
      jest.mock('../src/utils/logger.js', () => ({
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn()
        }
      }));
  
      // Mock processor
      const processorPromiseResolvers = [];
      const processWithRetry = jest.fn(() => {
        return new Promise((resolve) => {
          processorPromiseResolvers.push(resolve);
        });
      });
      jest.mock('../src/services/processor.js', () => ({ processWithRetry }));
  
      const queue = new WebhookQueue({
        processor: processWithRetry,
        metrics: {
          incReceived,
          incProcessed,
          incTooMany,
          setQueueLength,
          observeQueueTime,
          observeProcessingTime
        },
        concurrency: 1,
        threshold: 1
      });
  
      // Enqueue first item
      await queue.enqueue('item1');
      expect(queue.processing.size).toBe(1);
      expect(queue.queue.length).toBe(0);
      expect(processWithRetry).toHaveBeenCalledTimes(1);
  
      // Expect 8 assertions
      expect.assertions(8);
  
      // Test queue overload
      await expect(queue.enqueue('item2')).rejects.toThrow(QueueOverloadedError);
      await expect(queue.enqueue('item2')).rejects.toHaveProperty('message', 'Queue overloaded');
      expect(incTooMany).toHaveBeenCalledTimes(1);
  
      // Complete processing
      processorPromiseResolvers[0]();
      await new Promise((resolve) => setImmediate(resolve)); // Allow queue to process
      await queue.drain();
  
      expect(incReceived).toHaveBeenCalledTimes(2);
      expect(incProcessed).toHaveBeenCalledTimes(1);
    });
  });
  test('enforces concurrency limit', async () => {
    return jest.isolateModules(async () => {
      jest.resetModules();
      // Mock configuration to have concurrency of 2
      jest.mock('../src/config.js', () => ({
        CONCURRENCY: 2,
        OVERLOAD_THRESHOLD: 10
      }));

      // Mock metrics and logger
      const incReceived = jest.fn();
      const incProcessed = jest.fn();
      const incTooMany = jest.fn();
      const setQueueLength = jest.fn();
      const observeProcessingTime = jest.fn();
      const observeQueueTime = jest.fn();
      jest.mock('../src/utils/metrics.js', () => ({
        incReceived,
        incProcessed,
        incTooMany,
        setQueueLength,
        observeProcessingTime,
        observeQueueTime
      }));

      jest.mock('../src/utils/logger.js', () => ({
        logger: {
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          debug: jest.fn()
        }
      }));

      // Create delayed processors to inspect concurrent calls
      let rel1, rel2, rel3;
      const processWithRetry = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              rel1 = res;
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              rel2 = res;
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise((res) => {
              rel3 = res;
            })
        );
      jest.mock('../src/services/processor.js', () => ({ processWithRetry }));

      const queue = new WebhookQueue({
        processor: processWithRetry,
        metrics: {
          incReceived,
          incProcessed,
          incTooMany,
          setQueueLength,
          observeQueueTime,
          observeProcessingTime
        },
        concurrency: CONCURRENCY,
        threshold: OVERLOAD_THRESHOLD
      });

      // Enqueue three items
      await queue.enqueue('one');
      await queue.enqueue('two');
      await queue.enqueue('three');

      // Verify metrics for enqueuing
      expect(incReceived).toHaveBeenCalledTimes(3);

      // Only two should start processing concurrently due to concurrency limit
      expect(processWithRetry).toHaveBeenCalledTimes(2);

      // Release one and allow the third to start
      rel1();

      // Next tick to let queue pick up the next item
      await new Promise((res) => setImmediate(res));
      expect(processWithRetry).toHaveBeenCalledTimes(3);

      // Clean up remaining processors
      rel2();
      rel3();

      // Allow processing to complete
      await queue.drain();

      // Verify all items were processed
      expect(processWithRetry).toHaveBeenCalledTimes(3);
    });
  });
});