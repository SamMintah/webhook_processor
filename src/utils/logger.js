/**
 * Logger utility using Pino for structured JSON logging
 */
import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';

// Default log level from environment or fallback to 'info'
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Configure the base logger with options
const logger = pino({
  level: LOG_LEVEL,
  // Add timestamp to all logs
  timestamp: pino.stdTimeFunctions.isoTime,
  // Redact sensitive information
  redact: ['req.headers.authorization', 'req.headers.cookie'],
  // Include application name in all logs
  base: { app: 'webhook-processor' },
  // Use pretty printing in development
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard'
    }
  } : undefined
}, pino.destination(1)); // Explicitly use stdout (file descriptor 1)

// Configure the HTTP logger middleware
const httpLogger = pinoHttp({
  logger,
  // Generate unique request IDs
  genReqId: (req) => {
    return req.headers['x-request-id'] || randomUUID();
  },
  // Use custom serializers for request and response objects to reduce log verbosity
  serializers: {
    req: (req) => ({ 
      method: req.method, 
      url: req.url, 
      ip: req.ip,
      userAgent: req.headers['user-agent']
    }),
    res: (res) => ({ statusCode: res.statusCode }),
    err: pino.stdSerializers.err
  },
  // Customize log level based on response status
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  // Include custom attributes in the log
  customProps: (req, res) => {
    return {
      processingTime: res.responseTime
    };
  },
  // Enable auto-logging of requests
  autoLogging: true
});

export { logger, httpLogger };
