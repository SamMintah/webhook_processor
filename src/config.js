/**
 * Configuration module for the webhook processor application.
 * Loads environment variables from .env file and exports configuration constants.
 */

// Load environment variables from .env file
import 'dotenv/config';

/**
 * Application configuration object with all necessary constants.
 * Uses getters to dynamically read environment variables on each access.
 */
const config = {};

Object.defineProperties(config, {
  // Server configuration
  PORT: { 
    get() { return parseInt(process.env.PORT || '3000', 10); } 
  },
  
  // Queue configuration
  CONCURRENCY: { 
    get() { return parseInt(process.env.CONCURRENCY || '10', 10); } 
  },
  OVERLOAD_THRESHOLD: { 
    get() { return parseInt(process.env.OVERLOAD_THRESHOLD || '100', 10); } 
  },
  
  // Processing configuration
  PROCESSING_TIME_MS: { 
    get() { return parseInt(process.env.PROCESSING_TIME_MS || '1000', 10); } 
  },
  FAILURE_RATE: { 
    get() { return parseFloat(process.env.FAILURE_RATE || '0.1'); } 
  },
  MAX_RETRIES: { 
    get() { return parseInt(process.env.MAX_RETRIES || '1', 10); } 
  },
  RETRY_DELAY_MS: { 
    get() { return parseInt(process.env.RETRY_DELAY_MS || '2000', 10); } 
  },
  
  // Logging configuration
  LOG_LEVEL: { 
    get() { return process.env.LOG_LEVEL || 'info'; } 
  },
  
  // Node environment
  NODE_ENV: { 
    get() { return process.env.NODE_ENV || 'development'; } 
  },
  
  // Flag to determine if we're in a test environment
  IS_TEST: { 
    get() { return process.env.NODE_ENV === 'test'; } 
  }
});

export default config;
export const CONCURRENCY = config.CONCURRENCY;
export const OVERLOAD_THRESHOLD = config.OVERLOAD_THRESHOLD;
