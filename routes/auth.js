// routes/auth.js
// Login, registration, device provisioning.
// Routes are relative — server.js mounts this at '/'

import { Router } from 'express';
import { createHash } from 'crypto';
import { getDb } from '../db/schema.js';
import { generateToken, requireAuth } from '../middleware/auth.js';
import { appendAudit } from '../services/auditService.js';
import { loginRateLimiter, signupRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// ── POST /auth/register ────────────────────────────────────────
router.post('/auth/register', signupRateLimiter, (req, res) => {
  const { name, email, passphrase, pin, role = 'doctor', council_number, specialty, auto_verify } = req.body;
  if (!name || !email || !passphrase) {
    return res.status(400).json({ error: 'name, email, passphrase are required' });
  }
  const db = getDb();
  if (db.prepare('SELECT doctor_id FROM doctors WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const normalizedRole = role.toLowerCase().includes('staff') || role.toLowerCase().includes('nurse') ? 'staff' : 'doctor';
  const roleVerified = normalizedRole === 'staff' || auto_verify ? 1 : 0;
  const doctor_id = normalizedRole === 'doctor' ? `DOC-${Date.now()}` : `STAFF-${Date.now()}`;
  const passphrase_hash = createHash('sha256').update(passphrase).digest('hex');
  const pin_hash = pin ? createHash('sha256').update(pin).digest('hex') : null;

  db.prepare(`
    INSERT INTO doctors (doctor_id, name, email, role, pin_hash, passphrase_hash, council_number, specialty, role_verified, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(doctor_id, name, email, normalizedRole, pin_hash, passphrase_hash, council_number ?? null, specialty ?? null, roleVerified, Date.now());

  appendAudit({ doctor_id, action: 'create', entity_type: 'doctor', entity_id: doctor_id, detail: { name, email, role: normalizedRole, roleVerified } });
  res.status(201).json({
    doctor_id,
    name,
    email,
    role: normalizedRole,
    role_verified: roleVerified,
    message: roleVerified === 0 ? 'Doctor account created and submitted for administrative medical license verification.' : 'Account created and verified successfully.'
  });
});

// ── POST /auth/login ───────────────────────────────────────────
router.post('/auth/login', loginRateLimiter, (req, res) => {
  const { email, passphrase, device_id, station_name } = req.body;
  if (!email || !passphrase || !device_id) {
    return res.status(400).json({ error: 'email, passphrase, device_id are required' });
  }
  const db = getDb();
  const doctor = db.prepare('SELECT * FROM doctors WHERE email = ?').get(email);
  if (!doctor) return res.status(401).json({ error: 'Invalid credentials' });

  const hash = createHash('sha256').update(passphrase).digest('hex');
  if (hash !== doctor.passphrase_hash) return res.status(401).json({ error: 'Invalid credentials' });

  // Doctor verification check
  const isDoctorRole = doctor.role === 'doctor' || doctor.role === 'clinician';
  if (isDoctorRole && doctor.role_verified === 0) {
    return res.status(403).json({
      error: 'Doctor account is pending medical council / administrative verification. Please contact your medical superintendent or log in with verified staff credentials.',
      is_pending_verification: true,
      doctor_id: doctor.doctor_id,
    });
  }

  // Auto-register device if not known
  let device = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(device_id);
  if (!device) {
    db.prepare('INSERT INTO devices (device_id, station_name, registered_at) VALUES (?, ?, ?)')
      .run(device_id, station_name ?? device_id, Date.now());
    device = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(device_id);
  }
  if (device.revoked) return res.status(403).json({ error: 'Device has been revoked' });

  const token = generateToken(doctor.doctor_id, device_id);
  const expires_at = Date.now() + 12 * 60 * 60 * 1000;
  db.prepare('INSERT INTO sessions (token_id, doctor_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(token, doctor.doctor_id, device_id, Date.now(), expires_at);

  appendAudit({ doctor_id: doctor.doctor_id, device_id, action: 'login', entity_type: 'doctor', entity_id: doctor.doctor_id });

  res.json({
    token,
    expires_at,
    doctor: {
      doctor_id: doctor.doctor_id,
      name: doctor.name,
      email: doctor.email,
      role: doctor.role,
      role_verified: doctor.role_verified,
      specialty: doctor.specialty,
      council_number: doctor.council_number,
    },
    device: { device_id: device.device_id, station_name: device.station_name },
  });
});

// ── POST /auth/login/pin ───────────────────────────────────────
router.post('/auth/login/pin', loginRateLimiter, (req, res) => {
  const { doctor_id, pin, device_id } = req.body;
  if (!doctor_id || !pin || !device_id) {
    return res.status(400).json({ error: 'doctor_id, pin, device_id are required' });
  }
  const db = getDb();
  const doctor = db.prepare('SELECT * FROM doctors WHERE doctor_id = ?').get(doctor_id);
  if (!doctor || !doctor.pin_hash) return res.status(401).json({ error: 'PIN not set for this account' });

  const hash = createHash('sha256').update(pin).digest('hex');
  if (hash !== doctor.pin_hash) return res.status(401).json({ error: 'Invalid PIN' });

  const device = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(device_id);
  if (!device || device.revoked) return res.status(403).json({ error: 'Device invalid or revoked' });

  const token = generateToken(doctor.doctor_id, device_id);
  const expires_at = Date.now() + 12 * 60 * 60 * 1000;
  db.prepare('INSERT INTO sessions (token_id, doctor_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(token, doctor.doctor_id, device_id, Date.now(), expires_at);

  appendAudit({ doctor_id: doctor.doctor_id, device_id, action: 'login', entity_type: 'doctor', entity_id: doctor.doctor_id, detail: { mode: 'pin' } });
  res.json({
    token,
    expires_at,
    mode: 'pin',
    doctor: {
      doctor_id: doctor.doctor_id,
      name: doctor.name,
      email: doctor.email,
      role: doctor.role,
      role_verified: doctor.role_verified,
    }
  });
});

// ── GET /admin/doctors ─────────────────────────────────────────
router.get('/admin/doctors', requireAuth, (req, res) => {
  const db = getDb();
  const doctors = db.prepare('SELECT doctor_id, name, email, role, council_number, specialty, role_verified, created_at FROM doctors').all();
  res.json({ doctors });
});

// ── POST /admin/doctors/:id/verify ────────────────────────────
router.post('/admin/doctors/:id/verify', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE doctors SET role_verified = 1 WHERE doctor_id = ?').run(req.params.id);
  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'verify_doctor', entity_type: 'doctor', entity_id: req.params.id });
  res.json({ success: true, doctor_id: req.params.id, role_verified: 1 });
});

// ── POST /auth/emergency ───────────────────────────────────────
router.post('/auth/emergency', loginRateLimiter, (req, res) => {
  const { device_id } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id is required' });
  const db = getDb();
  let device = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(device_id);
  if (!device) {
    db.prepare('INSERT INTO devices (device_id, station_name, registered_at) VALUES (?, ?, ?)')
      .run(device_id, 'Emergency Device', Date.now());
    device = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(device_id);
  }
  if (device.revoked) return res.status(403).json({ error: 'Device has been revoked' });

  const emergencyDoctorId = `EMERGENCY-${Date.now()}`;
  const token = generateToken(emergencyDoctorId, device_id);
  const expires_at = Date.now() + 4 * 60 * 60 * 1000;

  // Insert a temporary emergency session (no doctor record needed)
  db.prepare('INSERT INTO sessions (token_id, doctor_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
    .run(token, 'EMERGENCY-BYPASS', device_id, Date.now(), expires_at);

  appendAudit({ doctor_id: 'EMERGENCY-BYPASS', device_id, action: 'emergency_bypass', entity_type: 'session', entity_id: token });
  res.json({ token, expires_at, mode: 'emergency', warning: 'All actions are logged for mandatory review.' });
});

// ── POST /auth/logout ──────────────────────────────────────────
router.post('/auth/logout', requireAuth, (req, res) => {
  const db = getDb();
  const token = req.headers['authorization'].slice(7);
  db.prepare('UPDATE sessions SET revoked = 1 WHERE token_id = ?').run(token);
  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'logout', entity_type: 'session', entity_id: token });
  res.json({ success: true });
});

// ── GET /auth/me ───────────────────────────────────────────────
router.get('/auth/me', requireAuth, (req, res) => {
  const db = getDb();
  const doctor = db.prepare('SELECT doctor_id, name, email, role, council_number, specialty, role_verified FROM doctors WHERE doctor_id = ?').get(req.doctor_id);
  const device = db.prepare('SELECT device_id, station_name FROM devices WHERE device_id = ?').get(req.device_id);
  res.json({ doctor, device });
});

// ── GET /admin/devices ─────────────────────────────────────────
router.get('/admin/devices', requireAuth, (req, res) => {
  const db = getDb();
  const devices = db.prepare('SELECT * FROM devices').all();
  res.json({ devices });
});

// ── POST /admin/devices/:device_id/revoke ─────────────────────
router.post('/admin/devices/:device_id/revoke', requireAuth, (req, res) => {
  const { device_id } = req.params;
  const db = getDb();
  db.prepare('UPDATE devices SET revoked = 1, revoked_at = ?, revoked_by = ? WHERE device_id = ?')
    .run(Date.now(), req.doctor_id, device_id);
  db.prepare('UPDATE sessions SET revoked = 1 WHERE device_id = ?').run(device_id);
  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'revoke_device', entity_type: 'device', entity_id: device_id });
  res.json({ success: true, device_id });
});

// ── POST /auth/reset-password ──────────────────────────────────
// Password reset endpoint protected by strict rate limit: max 3 per hour per IP.
router.post('/auth/reset-password', passwordResetRateLimiter, (req, res) => {
  const { email, current_passphrase, new_passphrase } = req.body;
  if (!email || !current_passphrase || !new_passphrase) {
    return res.status(400).json({ error: 'email, current_passphrase, and new_passphrase are required' });
  }
  if (new_passphrase.length < 8) {
    return res.status(400).json({ error: 'New passphrase must be at least 8 characters' });
  }

  const db = getDb();
  const doctor = db.prepare('SELECT * FROM doctors WHERE email = ?').get(email);
  if (!doctor) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const currentHash = createHash('sha256').update(current_passphrase).digest('hex');
  if (currentHash !== doctor.passphrase_hash) {
    return res.status(401).json({ error: 'Invalid current passphrase' });
  }

  const newHash = createHash('sha256').update(new_passphrase).digest('hex');
  db.prepare('UPDATE doctors SET passphrase_hash = ? WHERE doctor_id = ?').run(newHash, doctor.doctor_id);
  // Invalidate existing sessions
  db.prepare('UPDATE sessions SET revoked = 1 WHERE doctor_id = ?').run(doctor.doctor_id);

  appendAudit({ doctor_id: doctor.doctor_id, action: 'password_reset', entity_type: 'doctor', entity_id: doctor.doctor_id });
  res.json({ success: true, message: 'Passphrase reset successfully. Please log in with your new credentials.' });
});

export default router;
