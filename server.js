// server.js
// Swasthya Sync Backend — Express API server
// Implements: Auth, Patient CRUD, Sync Engine, Conflict Resolution, Audit Log

import express from 'express';
import cors from 'cors';
import { getDb } from './db/schema.js';
import { seedDatabase } from './db/seed.js';
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import syncRoutes from './routes/sync.js';

const PORT = process.env.PORT || 4000;
const app = express();

// ── Middleware ─────────────────────────────────────────────────
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Initialise DB ──────────────────────────────────────────────
getDb();           // creates schema
seedDatabase();    // seeds demo data on first run

// ── Routes ────────────────────────────────────────────────────
// Public Root & Health
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
          .endpoints { background: #002732; border-radius: 8px; padding: 16px; margin-top: 24px; font-family: monospace; font-size: 14px; }
          .endpoint-row { padding: 6px 0; border-bottom: 1px solid #083c4a; display: flex; justify-content: space-between; }
          .endpoint-row:last-child { border: none; }
          a.link { color: #5fd4ef; text-decoration: none; }
          a.link:hover { text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="container">
          <span class="badge">● SERVER ACTIVE (PORT 4000)</span>
          <h1>🏥 Swasthya Sync Backend API</h1>
          <p>Offline-First Multimodal Clinical Assistant & Differential Sync Engine (PS04) is running successfully.</p>
          <div>
            <a class="btn" href="http://localhost:5173" target="_blank">Open Web Application (Port 5173) →</a>
            <a class="btn" style="background: #1e5261; color: #fff;" href="/health" target="_blank">View /health JSON</a>
          </div>
          <div class="endpoints">
            <div style="color: #8ec3d3; margin-bottom: 10px; font-weight: bold;">AVAILABLE API ENDPOINTS:</div>
            <div class="endpoint-row"><span>GET /health</span> <a class="link" href="/health">Probe Health Check</a></div>
            <div class="endpoint-row"><span>POST /auth/login</span> <span>Clinician & Device Authentication</span></div>
            <div class="endpoint-row"><span>GET /patients</span> <span>Offline Patient Records & EHR</span></div>
            <div class="endpoint-row"><span>POST /sync/push</span> <span>Idempotent Differential Sync Push</span></div>
            <div class="endpoint-row"><span>GET /sync/pull</span> <span>Resumable Cursor Sync Pull</span></div>
            <div class="endpoint-row"><span>GET /sync/conflicts</span> <span>Discrepancy Inspector</span></div>
            <div class="endpoint-row"><span>GET /sync/audit</span> <span>Tamper-evident Hash Chain</span></div>
          </div>
        </div>
      </body>
      </html>
    `);
  } else {
    res.json({
      status: 'online',
      service: 'Swasthya Sync Healthcare Backend (PS04)',
      port: PORT,
      frontend: 'http://localhost:5173',
      endpoints: ['/health', '/auth/login', '/patients', '/sync/push', '/sync/pull', '/sync/conflicts', '/sync/audit']
    });
  }
});

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'Swasthya Sync', ts: Date.now() }));

// Auth (login, register, device management)
app.use('/', authRoutes);

// Patients (CRUD + encounters + prescriptions + allergy-check)
app.use('/patients', patientRoutes);

// Sync engine (push, pull, verify, conflicts, audit)
app.use('/sync', syncRoutes);

// Convenience: allergy check at root level
app.post('/allergy-check', async (req, res) => {
  const { patient_id, drug_names } = req.body;
  if (!patient_id || !Array.isArray(drug_names)) {
    return res.status(400).json({ error: 'patient_id and drug_names[] required' });
  }
  const { checkAllergies } = await import('./services/allergyChecker.js');
  const conflicts = checkAllergies(patient_id, drug_names);
  res.json({ patient_id, conflicts });
});
// ── Error handler ──────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: err.message });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏥 Swasthya Sync Backend running at http://localhost:${PORT}`);
  console.log(`   Endpoints:`);
  console.log(`     GET  /health`);
  console.log(`     POST /auth/register    — create doctor account`);
  console.log(`     POST /auth/login       — login (returns token)`);
  console.log(`     POST /auth/login/pin   — quick PIN login`);
  console.log(`     POST /auth/emergency   — emergency bypass`);
  console.log(`     GET  /auth/me          — current session`);
  console.log(`     GET  /patients         — patient list (search, triage filter)`);
  console.log(`     POST /patients         — create patient`);
  console.log(`     GET  /patients/:id     — patient detail`);
  console.log(`     POST /patients/:id/encounters  — new encounter`);
  console.log(`     POST /sync/push        — push operation batch`);
  console.log(`     GET  /sync/pull        — pull new operations`);
  console.log(`     GET  /sync/verify      — convergence checksum`);
  console.log(`     GET  /sync/conflicts   — open conflicts`);
  console.log(`     POST /sync/conflicts/:id/resolve`);
  console.log(`     GET  /sync/audit       — audit log\n`);
});
