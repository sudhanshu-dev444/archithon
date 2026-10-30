// backend/middleware/securityHeaders.js
// Production security headers conforming to OWASP and deployment hardening standards.
// Implements nosniff, frame denial, HSTS (1 year), strict Content-Security-Policy, etc.

export function securityHeadersMiddleware(req, res, next) {
  // 1. Prevent MIME-sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 2. Prevent clickjacking / frame embedding
  res.setHeader('X-Frame-Options', 'DENY');

  // 3. Strict-Transport-Security (HSTS): 1 year (31536000 seconds) with subdomains and preload
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 4. Content-Security-Policy (CSP): Restrict scripts to domain, prevent inline script execution
  const cspPolicy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' http://localhost:* ws://localhost:* http://127.0.0.1:* https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspPolicy);

  // 5. Additional hardening headers
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  next();
}

