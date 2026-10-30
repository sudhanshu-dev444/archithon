// middleware/auth.js
// Lightweight token-based auth middleware.
// In production, replace with a proper JWT library and key management.

import { getDb } from '../db/schema.js';
import { createHash } from 'crypto';
import { env } from '../config/env.js';

/**
 * Generates a cryptographic token from doctor_id + device_id + timestamp + token secret.
 */
export function generateToken(doctorId, deviceId) {
  const raw = `${doctorId}:${deviceId}:${Date.now()}:${env.tokenSecret}`;
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Verifies the token from the Authorization header and attaches
 * req.doctor_id, req.device_id to the request.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);
  const db = getDb();

  const session = db.prepare(`
    SELECT s.doctor_id, s.device_id, d.revoked AS device_revoked
    FROM sessions s
    JOIN devices d ON s.device_id = d.device_id
    WHERE s.token_id = ? AND s.revoked = 0 AND s.expires_at > ?
  `).get(token, Date.now());

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  if (session.device_revoked) {
    return res.status(403).json({ error: 'Device has been revoked. Sync is disabled.' });
  }

  req.doctor_id = session.doctor_id;
  req.device_id = session.device_id;

  const doc = db.prepare('SELECT role, role_verified FROM doctors WHERE doctor_id = ?').get(session.doctor_id);
  req.user_role = doc ? doc.role : (session.doctor_id.startsWith('EMERGENCY') ? 'emergency' : 'doctor');
  req.role_verified = doc ? doc.role_verified : 1;
  next();
}

/**
 * Requires admin or clinician role.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    const db = getDb();
    const doctor = db.prepare('SELECT role FROM doctors WHERE doctor_id = ?').get(req.doctor_id);
    if (!doctor || !roles.includes(doctor.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' | ')}` });
    }
    next();
  };
}

