// routes/auth.js
// Login, registration, device provisioning.
// Routes are relative — server.js mounts this at '/'

import { Router } from 'express';
import { createHash } from 'crypto';
import { getDb } from '../db/schema.js';
import { generateToken, requireAuth } from '../middleware/auth.js';
import { appendAudit } from '../services/auditService.js';

const router = Router();

// ── POST /auth/register ────────────────────────────────────────
router.post('/auth/register', (req, res) => {
  const { name, email, passphrase, pin, role = 'clinician', council_number, specialty } = req.body;
  if (!name || !email || !passphrase) {
    return res.status(400).json({ error: 'name, email, passphrase are required' });
  }
  const db = getDb();
  if (db.prepare('SELECT doctor_id FROM doctors WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const doctor_id = `DOC-${Date.now()}`;
  const passphrase_hash = createHash('sha256').update(passphrase).digest('hex');
  const pin_hash = pin ? createHash('sha256').update(pin).digest('hex') : null;

  db.prepare(`
    INSERT INTO doctors (doctor_id, name, email, role, pin_hash, passphrase_hash, council_number, specialty, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(doctor_id, name, email, role, pin_hash, passphrase_hash, council_number ?? null, specialty ?? null, Date.now());

  appendAudit({ doctor_id, action: 'create', entity_type: 'doctor', entity_id: doctor_id, detail: { name, email, role } });
  res.status(201).json({ doctor_id, name, email, role });
});

// ── POST /auth/login ───────────────────────────────────────────
router.post('/auth/login', (req, res) => {
  const { email, passphrase, device_id, station_name } = req.body;
  if (!email || !passphrase || !device_id) {
    return res.status(400).json({ error: 'email, passphrase, device_id are required' });
  }
  const db = getDb();
  const doctor = db.prepare('SELECT * FROM doctors WHERE email = ?').get(email);
  if (!doctor) return res.status(401).json({ error: 'Invalid credentials' });

  const hash = createHash('sha256').update(passphrase).digest('hex');
  if (hash !== doctor.passphrase_hash) return res.status(401).json({ error: 'Invalid credentials' });

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
    doctor: { doctor_id: doctor.doctor_id, name: doctor.name, email: doctor.email, role: doctor.role, specialty: doctor.specialty },
    device: { device_id: device.device_id, station_name: device.station_name },
  });
});

// ── POST /auth/login/pin ───────────────────────────────────────
router.post('/auth/login/pin', (req, res) => {
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
  res.json({ token, expires_at, mode: 'pin' });
});

// ── POST /auth/emergency ───────────────────────────────────────
router.post('/auth/emergency', (req, res) => {
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
  const doctor = db.prepare('SELECT doctor_id, name, email, role, council_number, specialty FROM doctors WHERE doctor_id = ?').get(req.doctor_id);
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

export default router;
