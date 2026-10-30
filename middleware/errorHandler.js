// backend/middleware/errorHandler.js
// Production-grade error handling middleware.
// Attaches a unique correlation ID to every request.
// Prevents leaking internal stack traces, DB queries, or server file paths to clients.

import { randomUUID } from 'crypto';

/**
 * Middleware that assigns a unique correlation ID to every incoming request.
 */
export function correlationIdMiddleware(req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || `corr_${randomUUID()}`;
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}

/**
 * Production 404 handler.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource could not be found.',
    correlationId: req.correlationId,
  });
}

/**
 * Global unhandled error handler.
 * Strips all internal server details before returning response to client.
 */
export function globalErrorHandler(err, req, res, _next) {
  const correlationId = req.correlationId || `corr_${randomUUID()}`;
  const statusCode = err.status || err.statusCode || 500;

  // Server-side logging only - includes full error stack and correlation ID for debugging
  console.error(`[ERROR] [${new Date().toISOString()}] CorrelationID: ${correlationId}`);
  console.error(`  Method: ${req.method} URL: ${req.originalUrl || req.url}`);
  console.error(`  Status: ${statusCode} Message: ${err.message}`);
  if (err.stack) {
    console.error(`  Stack: ${err.stack}`);
  }

  // Sanitize message for client
  let clientMessage = 'An unexpected internal error occurred. Please quote the correlation ID if contacting support.';
  if (statusCode < 500) {
    // Client errors (4xx) can have safe operational messages if they don't contain DB queries or file paths
    const msg = err.message || '';
    const containsSensitiveInfo = /sqlite|select|insert|update|delete|table|column|path|\/|\\/i.test(msg);
    if (!containsSensitiveInfo && msg.length > 0 && msg.length < 200) {
      clientMessage = msg;
    }
  }

  res.status(statusCode).json({
    error: statusCode === 404 ? 'Not Found' : statusCode >= 500 ? 'Internal Server Error' : 'Bad Request',
    message: clientMessage,
    correlationId,
  });
}

