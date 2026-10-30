// backend/middleware/rateLimiter.js
// Production rate limiting for authentication and sensitive endpoints.
// Sliding window algorithm per client IP address.

/**
 * Creates an in-memory sliding window rate limiter.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests allowed in the time window
 * @param {string} options.message - Error message when rate limit is exceeded
 */
export function createRateLimiter({ windowMs, max, message }) {
  // Map of ip -> array of request timestamps
  const hits = new Map();

  // Periodically clean up expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, valid);
      }
    }
  }, 5 * 60 * 1000).unref(); // unref so timer doesn't hold node process open

  return (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    const timestamps = hits.get(ip) || [];
    const recent = timestamps.filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const oldest = recent[0];
      const resetTimeMs = oldest + windowMs - now;
      const retryAfterSec = Math.max(1, Math.ceil(resetTimeMs / 1000));

      res.setHeader('Retry-After', retryAfterSec);
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil((oldest + windowMs) / 1000));

      return res.status(429).json({
        error: 'Too Many Requests',
        message: message || `Too many requests from this IP. Please try again in ${retryAfterSec} seconds.`,
        retryAfter: retryAfterSec,
        correlationId: req.correlationId,
      });
    }

    recent.push(now);
    hits.set(ip, recent);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', max - recent.length);

    next();
  };
}

/**
 * 5 attempts per minute per IP for login endpoints (login, pin login, emergency bypass).
 */
export const loginRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many login attempts. Maximum 5 attempts per minute allowed. Please try again shortly.',
});

/**
 * 5 attempts per minute per IP for registration/signup endpoints.
 */
export const signupRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: 'Too many account registration attempts. Maximum 5 attempts per minute allowed.',
});

/**
 * 3 attempts per hour per IP for password reset and recovery endpoints.
 */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: 'Too many password reset attempts. Maximum 3 attempts per hour allowed. Please try again later.',
});

