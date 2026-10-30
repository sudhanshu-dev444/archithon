// server.js
// Swasthya Sync Backend — Hardened Express API Server
// Production-ready: OWASP Security Headers, Strict CORS, Correlation IDs, Sanitized Error Handling.

import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { getDb } from './db/schema.js';
import { seedDatabase } from './db/seed.js';
import { requireAuth } from './middleware/auth.js';
import { correlationIdMiddleware, globalErrorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { securityHeadersMiddleware } from './middleware/securityHeaders.js';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import syncRoutes from './routes/sync.js';

const PORT = env.PORT;
const app = express();

// ── Disable Express Fingerprinting ─────────────────────────────
app.disable('x-powered-by');

// ── Security Headers (HSTS, CSP, nosniff, DENY, etc.) ─────────
app.use(securityHeadersMiddleware);

// ── Correlation ID Tracking ────────────────────────────────────
app.use(correlationIdMiddleware);

// ── CORS Configuration (Strict Whitelist, No Wildcard *) ───────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
];

if (env.frontendUrl) {
  const customOrigins = env.frontendUrl.split(',').map((o) => o.trim()).filter(Boolean);
  allowedOrigins.push(...customOrigins);
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development, allow localhost on any port
      if (!env.isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }

      const corsErr = new Error('Not allowed by CORS');
      corsErr.status = 403;
      return callback(corsErr);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['X-Correlation-ID', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400, // 24 hours preflight cache
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logger with correlation ID
app.use((req, _res, next) => {
  const corr = req.correlationId || '-';
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '-';
  console.log(`[${new Date().toISOString()}] [${corr}] ${req.method} ${req.path} (IP: ${ip})`);
  next();
});

// ── Initialise DB ──────────────────────────────────────────────
getDb();           // creates schema with secure pragma and file permissions
seedDatabase();    // seeds demo data only in development or if ALLOW_DEMO_SEED=true

// ── Routes ────────────────────────────────────────────────────
// Public Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Swasthya Sync Healthcare Backend (PS04)',
    environment: env.NODE_ENV,
    ts: Date.now(),
  });
});

// Public Root Info
app.get('/', (req, res) => {
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Swasthya Sync — Clinical Backend</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #001f28; color: #e1f4fd; margin: 0; padding: 40px 20px; }
          .container { max-width: 720px; margin: 0 auto; background: #003441; border: 1px solid #1e5261; border-radius: 16px; padding: 32px; box-shadow: 0 12px 36px rgba(0,0,0,0.4); }
          .badge { display: inline-block; background: #00d4b8; color: #003730; font-weight: 700; padding: 4px 12px; border-radius: 999px; font-size: 13px; margin-bottom: 16px; }
          h1 { margin: 0 0 10px; font-size: 26px; color: #ffffff; }
          p { color: #8ec3d3; margin: 0 0 20px; font-size: 15px; line-height: 1.5; }
          .btn { display: inline-block; background: #00d4b8; color: #003730; text-decoration: none; font-weight: bold; padding: 10px 20px; border-radius: 8px; margin-right: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <span class="badge">● PRODUCTION HARDENED</span>
          <h1>🏥 Swasthya Sync Backend API</h1>
          <p>Offline-First Multimodal Clinical Assistant & Differential Sync Engine (PS04) is running securely.</p>
          <div>
            <a class="btn" href="/health">Health Probe Check</a>
          </div>
        </div>
      </body>
      </html>
    `);
  } else {
    res.json({
      status: 'online',
      service: 'Swasthya Sync Healthcare Backend (PS04)',
      environment: env.NODE_ENV,
      port: PORT,
    });
  }
});

// Auth Routes (Login, Register, PIN, Emergency, Me, Reset Password with rate limiting)
app.use('/', authRoutes);

// Patients Routes (CRUD + Encounters + Prescriptions + Allergy Check)
app.use('/patients', patientRoutes);

// Reports & Clinical Records Aggregator (for Reports Tab & Filters)
app.get('/reports/clinical-records', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    const { q, type, status, doctor, date_from, date_to, limit = 200 } = req.query;

    // 1. Encounters (Notes)
    const encs = db.prepare(`
      SELECT
        e.encounter_id as id,
        'notes' as record_type,
        e.patient_id,
        COALESCE(p.name, e.patient_id, 'Patient') as patient_name,
        e.doctor_id,
        COALESCE(d.name, e.doctor_id, 'Dr. Priya Sharma') as doctor_name,
        e.status,
        e.complaint || ' — ' || COALESCE(e.diagnosis, 'Clinical Assessment') as title,
        e.diagnosis,
        e.history,
        e.vitals,
        e.encounter_ts as timestamp
      FROM encounters e
      LEFT JOIN patients p ON e.patient_id = p.patient_id
      LEFT JOIN doctors d ON e.doctor_id = d.doctor_id
      ORDER BY e.encounter_ts DESC
    `).all();

    // Attach prescriptions to each encounter record
    const rxStmt = db.prepare('SELECT drug_name as name, dosage, frequency, duration, route FROM prescriptions WHERE encounter_id = ?');
    const encsWithMeds = encs.map((e) => ({
      ...e,
      medications: rxStmt.all(e.id),
    }));

    // 2. Prescriptions
    const rxs = db.prepare(`
      SELECT
        pr.prescription_id as id,
        'prescription' as record_type,
        pr.patient_id,
        COALESCE(p.name, pr.patient_id, 'Patient') as patient_name,
        COALESCE(e.doctor_id, 'DOC-001') as doctor_id,
        COALESCE(d.name, 'Dr. Priya Sharma') as doctor_name,
        pr.status,
        pr.drug_name || ' (' || COALESCE(pr.dosage, 'Standard Dose') || ')' as title,
        pr.drug_name,
        pr.dosage,
        pr.frequency,
        pr.duration,
        pr.route,
        pr.created_at as timestamp
      FROM prescriptions pr
      LEFT JOIN encounters e ON pr.encounter_id = e.encounter_id
      LEFT JOIN patients p ON pr.patient_id = p.patient_id
      LEFT JOIN doctors d ON e.doctor_id = d.doctor_id
      ORDER BY pr.created_at DESC
    `).all();

    // 3. Audio Recordings
    const audios = db.prepare(`
      SELECT
        ar.recording_id as id,
        'audio' as record_type,
        ar.patient_id,
        COALESCE(p.name, ar.patient_id, 'Patient') as patient_name,
        ar.recorded_by as doctor_id,
        COALESCE(d.name, ar.recorded_by, 'Clinical Staff') as doctor_name,
        'saved' as status,
        'Ambient Clinical Dictation (' || ar.duration_seconds || 's, ' || UPPER(ar.language) || ')' as title,
        ar.language,
        ar.duration_seconds,
        ar.recorded_by_role,
        ar.transcript,
        ar.created_at as timestamp
      FROM audio_recordings ar
      LEFT JOIN patients p ON ar.patient_id = p.patient_id
      LEFT JOIN doctors d ON ar.recorded_by = d.doctor_id
      ORDER BY ar.created_at DESC
    `).all();

    // Merge all records
    let all = [...encsWithMeds, ...rxs, ...audios];

    // Apply query filters safely
    if (type && type !== 'all') {
      all = all.filter((r) => r.record_type === type);
    }
    if (status && status !== 'all') {
      all = all.filter((r) => (r.status || '').toLowerCase() === status.toLowerCase());
    }
    if (doctor && doctor !== 'all') {
      all = all.filter(
        (r) =>
          (r.doctor_name || '').toLowerCase().includes(doctor.toLowerCase()) ||
          (r.doctor_id || '').toLowerCase().includes(doctor.toLowerCase())
      );
    }
    if (date_from) {
      const fromTs = new Date(date_from).getTime();
      if (!isNaN(fromTs)) all = all.filter((r) => r.timestamp >= fromTs);
    }
    if (date_to) {
      const toTs = new Date(date_to).getTime() + 86400000;
      if (!isNaN(toTs)) all = all.filter((r) => r.timestamp <= toTs);
    }
    if (q) {
      const lowerQ = q.toLowerCase();
      all = all.filter(
        (r) =>
          (r.patient_name || '').toLowerCase().includes(lowerQ) ||
          (r.patient_id || '').toLowerCase().includes(lowerQ) ||
          (r.title || '').toLowerCase().includes(lowerQ) ||
          (r.id || '').toLowerCase().includes(lowerQ)
      );
    }

    // Sort by latest timestamp
    all.sort((a, b) => b.timestamp - a.timestamp);

    res.json({
      total: all.length,
      records: all.slice(0, parseInt(limit, 10)),
    });
  } catch (err) {
    next(err);
  }
});

// Sync Engine Routes (push, pull, verify, conflicts, audit)
app.use('/sync', syncRoutes);

// Convenience: allergy check
app.post('/allergy-check', async (req, res, next) => {
  try {
    const { patient_id, drug_names } = req.body;
    if (!patient_id || !Array.isArray(drug_names)) {
      return res.status(400).json({ error: 'patient_id and drug_names[] required' });
    }
    const { checkAllergies } = await import('./services/allergyChecker.js');
    const conflicts = checkAllergies(patient_id, drug_names);
    res.json({ patient_id, conflicts });
  } catch (err) {
    next(err);
  }
});

// ── 404 Handler (Sanitized with Correlation ID) ────────────────
app.use(notFoundHandler);

// ── Global Error Handler (Sanitized with Correlation ID) ───────
app.use(globalErrorHandler);

// ── Start Server ───────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏥 Swasthya Sync Backend running securely at http://localhost:${PORT}`);
  console.log(`   Environment: ${env.NODE_ENV} | Debug: ${env.debugMode}`);
  console.log(`   Security Headers: ACTIVE (nosniff, DENY, HSTS, CSP)`);
  console.log(`   Rate Limiting: ACTIVE (Auth, Pin, Emergency, Reset)`);
  console.log(`   Correlation ID Tracking: ACTIVE\n`);
});
