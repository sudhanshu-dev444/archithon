// backend/config/env.js
// Environment variable validation and production readiness configuration.
// Refuses to start if critical variables are missing or insecure in production.

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function validateEnv() {
  const NODE_ENV = process.env.NODE_ENV || 'development';
  const isProduction = NODE_ENV === 'production';
  const errors = [];

  // 1. Port
  const PORT = parseInt(process.env.PORT, 10) || 4000;
  if (isNaN(PORT) || PORT <= 0 || PORT > 65535) {
    errors.push(`Invalid PORT specified: "${process.env.PORT}". Must be an integer between 1 and 65535.`);
  }

  // 2. Auth Secret (TOKEN_SECRET / JWT_SECRET)
  const tokenSecret = process.env.TOKEN_SECRET || process.env.JWT_SECRET;
  if (isProduction) {
    if (!tokenSecret) {
      errors.push('CRITICAL: TOKEN_SECRET environment variable is not set. In production, a strong auth secret is required.');
    } else if (tokenSecret === 'swasthya-secret-2026' || tokenSecret.length < 32) {
      errors.push('CRITICAL: TOKEN_SECRET is using a weak or default value. In production, provide a cryptographically random secret with at least 32 characters.');
    }
  }

  // 3. Database URL / Path
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    // If an external database URL is provided, check for TLS/SSL in production
    if (isProduction) {
      const lower = dbUrl.toLowerCase();
      const hasSsl = lower.includes('sslmode=require') || lower.includes('ssl=true') || lower.includes('ssl=require');
      if (!hasSsl) {
        errors.push('CRITICAL: DATABASE_URL must require TLS/SSL in production (e.g., sslmode=require or ssl=true).');
      }
      // Check for default credentials
      const defaultCreds = ['postgres:postgres@', 'root:root@', 'admin:admin@', 'root:password@', 'postgres:password@'];
      if (defaultCreds.some((c) => lower.includes(c))) {
        errors.push('CRITICAL: DATABASE_URL uses insecure default credentials. Change your database user and password before deploying.');
      }
    }
  }

  // 4. Debug Mode (Must default to OFF)
  const debugMode = process.env.DEBUG === 'true';
  if (isProduction && debugMode) {
    console.warn('⚠️ WARNING: DEBUG mode is enabled in a production environment. Consider disabling DEBUG for production.');
  }

  // 5. Allowed Origins for CORS
  const frontendUrl = process.env.FRONTEND_URL || process.env.ALLOWED_ORIGINS;
  if (isProduction && !frontendUrl) {
    console.warn('⚠️ NOTICE: FRONTEND_URL not set in production. Defaulting to strict localhost origin matching.');
  }

  if (errors.length > 0) {
    console.error('\n' + '='.repeat(70));
    console.error('❌ FATAL: SERVER REFUSED TO START DUE TO CONFIGURATION ERRORS:');
    errors.forEach((err, idx) => console.error(`  ${idx + 1}. ${err}`));
    console.error('='.repeat(70) + '\n');
    process.exit(1);
  }

  return {
    PORT,
    NODE_ENV,
    isProduction,
    tokenSecret: tokenSecret || 'swasthya-secret-2026',
    debugMode,
    frontendUrl,
    dbPath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'db', 'swasthya.db'),
  };
}

export const env = validateEnv();

