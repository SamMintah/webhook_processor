// src/middleware/logging.js

/**
 * Logging middleware using Pino HTTP for structured JSON logging
 * This middleware should be applied globally to the Express app.
 */
import { httpLogger } from '../utils/logger.js';

export default httpLogger;
