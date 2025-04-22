import express from 'express';
import loggingMiddleware from './middleware/logging.js';
import rateLimitMiddleware from './middleware/rateLimit.js';
import webhookRouter from './routes/webhook.js';
import healthRouter from './routes/health.js';
import metricsRouter from './routes/metrics.js';
import errorHandler from './middleware/errorHandler.js';

// Create Express application
const app = express();

// Middleware: parse JSON bodies
app.use(express.json());

// Middleware: structured logging
app.use(loggingMiddleware);

// Routes
app.use('/health', healthRouter);
app.use('/metrics', metricsRouter);
app.use('/webhook', rateLimitMiddleware, webhookRouter);

// Error handling middleware (must be last)
app.use(errorHandler);

// Export the configured app for mounting or testing
export default app;
