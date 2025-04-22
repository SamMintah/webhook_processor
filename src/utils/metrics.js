/**
 * Prometheus metrics utilities
 * 
 * This module initializes and exports Prometheus metrics for monitoring
 * the webhook processing system.
 * 
 * Exposes a /metrics endpoint for Prometheus scraping.
 */

import { Registry, collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';

// Create a custom registry
const register = new Registry();

// Enable default metrics collection only outside of tests
if (process.env.NODE_ENV !== 'test') {
  collectDefaultMetrics({ register });
}

// Initialize counters
const totalReceivedCounter = new Counter({
  name: 'webhook_total_received',
  help: 'Total number of webhook requests received',
  registers: [register]
});

const totalProcessedCounter = new Counter({
  name: 'webhook_total_processed',
  help: 'Total number of webhook requests successfully processed',
  registers: [register]
});

const tooManyRequestsCounter = new Counter({
  name: 'webhook_too_many_requests',
  help: 'Total number of webhook requests rejected due to queue overload',
  registers: [register]
});

// Initialize gauge
const queueLengthGauge = new Gauge({
  name: 'webhook_queue_length',
  help: 'Current length of the webhook processing queue',
  registers: [register]
});

// Initialize histogram
const processingTimeHistogram = new Histogram({
  name: 'webhook_processing_time_ms',
  help: 'Webhook processing time in milliseconds',
  buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000], // buckets in ms
  registers: [register]
});

// Initialize queue time histogram
const queueTimeHistogram = new Histogram({
  name: 'webhook_queue_time_ms',
  help: 'Time items spend in the queue in ms',
  buckets: [10, 50, 100, 200, 500, 1000],
  registers: [register]
});

/**
 * Increment the total received webhooks counter
 */
export function incReceived() {
  totalReceivedCounter.inc();
}

/**
 * Increment the total processed webhooks counter
 */
export function incProcessed() {
  totalProcessedCounter.inc();
}

/**
 * Increment the too many requests counter
 */
export function incTooMany() {
  tooManyRequestsCounter.inc();
}

/**
 * Set the current queue length
 * @param {number} length - Current length of the queue
 */
export function setQueueLength(length) {
  queueLengthGauge.set(length);
}

/**
 * Observe processing time for a webhook
 * @param {number} timeMs - Processing time in milliseconds
 */
export function observeProcessingTime(timeMs) {
  processingTimeHistogram.observe(timeMs);
}

/**
 * Observe time spent in queue for a webhook
 * @param {number} timeMs - Queue time in milliseconds
 */
export function observeQueueTime(timeMs) {
  queueTimeHistogram.observe(timeMs);
}

/**
 * Get metrics in Prometheus format
 * @returns {Promise<string>} Metrics in Prometheus format
 */
export async function getMetrics() {
  return register.metrics();
}

/**
 * Get content type for Prometheus metrics
 * @returns {string} Content type
 */
export function getMetricsContentType() {
  return register.contentType;
}

// Export the custom Prometheus registry for the metrics endpoint
export { register };
