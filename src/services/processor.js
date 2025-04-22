/**
 * Processor service for handling webhook items with retry capability
 */

import { logger } from '../utils/logger.js';

/**
 * Simulates processing delay between 100-300ms
 * @returns {Promise} Promise that resolves after the delay
 */
const simulateProcessingDelay = () => {
  const delay = Math.floor(Math.random() * 201) + 100; // Random delay between 100-300ms
  return new Promise(resolve => {
    const timer = setTimeout(resolve, delay);
    timer.unref();
  });
};

/**
 * Simulates a processing attempt with 10% chance of failure
 * @param {Object} item - The item to process
 * @returns {Promise} Promise that resolves on success or rejects on failure
 */
const attemptProcessing = (item) => {
  return new Promise((resolve, reject) => {
    // 10% chance of failure
    if (Math.random() < 0.1) {
      logger.warn({ item, error: 'Processing failed' }, 'Item processing failed');
      reject(new Error('Processing failed'));
    } else {
      resolve({ success: true, item });
    }
  });
};

/**
 * Processes an item with one retry on failure
 * @param {Object} item - The item to process
 * @returns {Promise} Promise that resolves with the processing result or rejects after retry failure
 */
const processWithRetry = async (item) => {
  try {
    // Simulate processing delay
    await simulateProcessingDelay();
    
    // First attempt
    return await attemptProcessing(item);
  } catch (error) {
    logger.info({ item }, 'Retrying item processing');
    
    // Retry with another delay
    await simulateProcessingDelay();
    
    // Second and final attempt
    try {
      return await attemptProcessing(item);
    } catch (retryError) {
      logger.error({ item, error: retryError.message }, 'Item processing failed after retry');
      throw retryError;
    }
  }
};

export {
  processWithRetry
};
