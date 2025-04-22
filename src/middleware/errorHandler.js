import { logger } from '../utils/logger.js';

// Centralized error-handling middleware
export default function errorHandler(err, req, res, next) {
  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal Server Error' });
}