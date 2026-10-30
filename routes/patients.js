// routes/patients.js
// Patient CRUD, allergy management, vitals, encounter history.

import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { appendAudit } from '../services/auditService.js';
import { checkAllergies } from '../services/allergyChecker.js';

const router = Router();

// ── GET /patients ──────────────────────────────────────────────
// List all patients with optional search query.
router.get('/', requireAuth, (req, res) => {
  const { q, triage, limit = 100, offset = 0 } = req.query;
  const db = getDb();
  let query = 'SELECT * FROM patients WHERE 1=1';
  const params = [];

  if (q) {
    query += ' AND (name LIKE ? OR patient_id LIKE ? OR condition LIKE ? OR village LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  if (triage) {
    query += ' AND triage = ?';
    params.push(triage);
  }

  query += " ORDER BY CASE triage WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END, updated_at DESC LIMIT ? OFFSET ?";
  params.push(parseInt(limit), parseInt(offset));

  const patients = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM patients').get();

  // Attach allergy counts for banner
  const withAllergies = patients.map(p => {
    const allergies = db.prepare('SELECT * FROM allergies WHERE patient_id = ?').all(p.patient_id);
    return { ...p, allergies };
  });

  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'view', entity_type: 'patient_list', entity_id: 'LIST' });
  res.json({ patients: withAllergies, total: total.cnt });
});

// ── POST /patients ─────────────────────────────────────────────
// Create a new patient.
router.post('/', requireAuth, (req, res) => {
  const {
    patient_id, abha, name, age, sex, village, ward, phone, condition,
    triage = 'routine', summary, date_of_birth, address,
    emergency_contact_name, emergency_contact_phone, photo_url
  } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = getDb();
  const pid = patient_id || `PAT-${Date.now()}`;
  const now = Date.now();

  // Duplicate check
  if (abha) {
    const existing = db.prepare('SELECT patient_id FROM patients WHERE abha = ?').get(abha);
    if (existing) return res.status(409).json({ error: 'Patient with this ABHA ID already exists', existing_id: existing.patient_id });
  }

  db.prepare(`
    INSERT INTO patients (
      patient_id, abha, name, age, sex, village, ward, phone, condition,
      triage, summary, date_of_birth, address, emergency_contact_name,
      emergency_contact_phone, photo_url, version, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    pid, abha || null, name, age || null, sex || null, village || null, ward || null,
    phone || null, condition || null, triage, summary || null,
    date_of_birth || null, address || null, emergency_contact_name || null,
    emergency_contact_phone || null, photo_url || null, now, now
  );

  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'create', entity_type: 'patient', entity_id: pid, patient_id: pid });
  res.status(201).json({ patient_id: pid });
});

// ── GET /patients/:id ──────────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const patient = db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });

  const allergies = db.prepare('SELECT * FROM allergies WHERE patient_id = ?').all(req.params.id);
  const encounters = db.prepare('SELECT * FROM encounters WHERE patient_id = ? ORDER BY encounter_ts DESC').all(req.params.id);
  const audio_recordings = db.prepare('SELECT * FROM audio_recordings WHERE patient_id = ? ORDER BY created_at DESC').all(req.params.id);

  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'view', entity_type: 'patient', entity_id: req.params.id, patient_id: req.params.id });
  res.json({ ...patient, allergies, encounters, audio_recordings });
});

// ── PATCH /patients/:id ────────────────────────────────────────
router.patch('/:id', requireAuth, (req, res) => {
  const db = getDb();
  let patient = db.prepare('SELECT * FROM patients WHERE patient_id = ?').get(req.params.id);

  const {
    name, age, sex, village, ward, phone, condition, triage, summary,
    date_of_birth, address, emergency_contact_name, emergency_contact_phone, photo_url
  } = req.body;
  const now = Date.now();

  if (!patient) {
    // Seamless Upsert for offline or client-generated patient records
    const pid = req.params.id;
    db.prepare(`
      INSERT INTO patients (
        patient_id, name, age, sex, village, ward, phone, condition,
        triage, summary, date_of_birth, address, emergency_contact_name,
        emergency_contact_phone, photo_url, version, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      pid, name || 'Patient ' + pid, age || null, sex || null, village || 'Ganiyari Outpost Hub',
      ward || null, phone || null, condition || null, triage || 'routine',
      summary || null, date_of_birth || null, address || null,
      emergency_contact_name || null, emergency_contact_phone || null,
      photo_url || null, now, now
    );
    appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'create', entity_type: 'patient', entity_id: pid, patient_id: pid });
    return res.json({ success: true, version: 1 });
  }

  const newVersion = (patient.version || 0) + 1;

  db.prepare(`
    UPDATE patients SET
      name = COALESCE(?, name),
      age = COALESCE(?, age),
      sex = COALESCE(?, sex),
      village = COALESCE(?, village),
      ward = COALESCE(?, ward),
      phone = COALESCE(?, phone),
      condition = COALESCE(?, condition),
      triage = COALESCE(?, triage),
      summary = COALESCE(?, summary),
      date_of_birth = COALESCE(?, date_of_birth),
      address = COALESCE(?, address),
      emergency_contact_name = COALESCE(?, emergency_contact_name),
      emergency_contact_phone = COALESCE(?, emergency_contact_phone),
      photo_url = COALESCE(?, photo_url),
      version = ?,
      updated_at = ?
    WHERE patient_id = ?
  `).run(
    name ?? null, age ?? null, sex ?? null, village ?? null, ward ?? null, phone ?? null,
    condition ?? null, triage ?? null, summary ?? null,
    date_of_birth ?? null, address ?? null, emergency_contact_name ?? null,
    emergency_contact_phone ?? null, photo_url ?? null,
    newVersion, now, req.params.id
  );

  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'edit', entity_type: 'patient', entity_id: req.params.id, patient_id: req.params.id });
  res.json({ success: true, version: newVersion });
});

// ── POST /patients/:id/audio ───────────────────────────────────
// Save audio recording metadata linked to patient and encounter.
router.post('/:id/audio', requireAuth, (req, res) => {
  const {
    recording_id, encounter_id, duration_seconds = 0, language = 'hi',
    recorded_by, recorded_by_role = 'Doctor', transcript, file_name
  } = req.body;

  const db = getDb();
  const rid = recording_id || `REC-${Date.now()}`;
  const now = Date.now();

  db.prepare(`
    INSERT INTO audio_recordings (
      recording_id, patient_id, encounter_id, duration_seconds, language,
      recorded_by, recorded_by_role, transcript, file_name, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    rid, req.params.id, encounter_id || null, duration_seconds, language,
    recorded_by || req.doctor_id || 'DOC-001', recorded_by_role,
    transcript || null, file_name || null, now
  );

  appendAudit({
    doctor_id: req.doctor_id,
    device_id: req.device_id,
    action: 'save_audio',
    entity_type: 'audio_recording',
    entity_id: rid,
    patient_id: req.params.id
  });

  res.status(201).json({ recording_id: rid, patient_id: req.params.id, success: true });
});

// ── GET /patients/:id/audio ────────────────────────────────────
router.get('/:id/audio', requireAuth, (req, res) => {
  const db = getDb();
  const recordings = db.prepare('SELECT * FROM audio_recordings WHERE patient_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json({ recordings });
});

// ── GET /patients/:id/allergies ────────────────────────────────
router.get('/:id/allergies', requireAuth, (req, res) => {
  const db = getDb();
  const allergies = db.prepare('SELECT * FROM allergies WHERE patient_id = ?').all(req.params.id);
  res.json({ allergies });
});

// ── POST /patients/:id/allergies ───────────────────────────────
router.post('/:id/allergies', requireAuth, (req, res) => {
  const { name, severity, reaction, cross_reactivity = [] } = req.body;
  if (!name) return res.status(400).json({ error: 'Allergy name is required' });

  const db = getDb();
  const allergy_id = `ALG-${req.params.id}-${Date.now()}`;
  db.prepare(`
    INSERT INTO allergies (allergy_id, patient_id, name, severity, reaction, cross_reactivity, recorded_by, recorded_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(allergy_id, req.params.id, name, severity || null, reaction || null,
         JSON.stringify(cross_reactivity), req.doctor_id, Date.now());

  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'create', entity_type: 'allergy', entity_id: allergy_id, patient_id: req.params.id });
  res.status(201).json({ allergy_id });
});

// ── GET /patients/:id/encounters ───────────────────────────────
router.get('/:id/encounters', requireAuth, (req, res) => {
  const db = getDb();
  const encounters = db.prepare('SELECT * FROM encounters WHERE patient_id = ? ORDER BY encounter_ts DESC').all(req.params.id);
  const withRx = encounters.map(enc => {
    const prescriptions = db.prepare('SELECT * FROM prescriptions WHERE encounter_id = ?').all(enc.encounter_id);
    return { ...enc, prescriptions };
  });
  res.json({ encounters: withRx });
});

// ── POST /patients/:id/encounters ─────────────────────────────
router.post('/:id/encounters', requireAuth, (req, res) => {
  const { complaint, history, diagnosis, icd10_code, vitals, encounter_id: clientEncId, status = 'approved', recorded_by } = req.body;
  const db = getDb();
  const encounter_id = clientEncId || req.body.id || `ENC-${Date.now()}`;
  const now = Date.now();
  const doctor_id = recorded_by || req.doctor_id || 'DOC-001';
  const approvedAt = status === 'approved' ? now : null;
  const approvedBy = status === 'approved' ? doctor_id : null;

  db.prepare(`
    INSERT INTO encounters
      (encounter_id, patient_id, doctor_id, device_id, encounter_ts, complaint, history, diagnosis, icd10_code, vitals, status, approved_by, approved_at, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    ON CONFLICT(encounter_id) DO UPDATE SET
      complaint = excluded.complaint,
      history = excluded.history,
      diagnosis = excluded.diagnosis,
      icd10_code = excluded.icd10_code,
      vitals = excluded.vitals,
      status = excluded.status,
      approved_by = excluded.approved_by,
      approved_at = excluded.approved_at,
      updated_at = excluded.updated_at
  `).run(encounter_id, req.params.id, doctor_id, req.device_id, now,
         complaint || null, history || null, diagnosis || null, icd10_code || null,
         vitals ? (typeof vitals === 'object' ? JSON.stringify(vitals) : vitals) : null,
         status, approvedBy, approvedAt, now, now);

  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'create', entity_type: 'encounter', entity_id: encounter_id, patient_id: req.params.id });
  res.status(201).json({ encounter_id });
});

// ── GET /patients/:id/encounters/:enc_id ───────────────────────
router.get('/:id/encounters/:enc_id', requireAuth, (req, res) => {
  const db = getDb();
  const encounter = db.prepare('SELECT * FROM encounters WHERE encounter_id = ? AND patient_id = ?').get(req.params.enc_id, req.params.id);
  if (!encounter) return res.status(404).json({ error: 'Encounter not found' });

  const prescriptions = db.prepare('SELECT * FROM prescriptions WHERE encounter_id = ?').all(req.params.enc_id);
  const attachments = db.prepare('SELECT * FROM attachments WHERE encounter_id = ?').all(req.params.enc_id);

  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'view', entity_type: 'encounter', entity_id: req.params.enc_id, patient_id: req.params.id });
  res.json({ ...encounter, prescriptions, attachments });
});

// ── PATCH /patients/:id/encounters/:enc_id ─────────────────────
router.patch('/:id/encounters/:enc_id', requireAuth, (req, res) => {
  const db = getDb();
  const encounter = db.prepare('SELECT * FROM encounters WHERE encounter_id = ? AND patient_id = ?').get(req.params.enc_id, req.params.id);
  if (!encounter) return res.status(404).json({ error: 'Encounter not found' });

  const { complaint, history, diagnosis, icd10_code, vitals, status } = req.body;
  const newVersion = encounter.version + 1;
  const now = Date.now();

  let approvedAt = encounter.approved_at;
  let approvedBy = encounter.approved_by;
  if (status === 'approved') {
    approvedAt = now;
    approvedBy = req.doctor_id;
  }

  db.prepare(`
    UPDATE encounters SET
      complaint = COALESCE(?, complaint),
      history = COALESCE(?, history),
      diagnosis = COALESCE(?, diagnosis),
      icd10_code = COALESCE(?, icd10_code),
      vitals = COALESCE(?, vitals),
      status = COALESCE(?, status),
      approved_at = ?,
      approved_by = ?,
      version = ?,
      updated_at = ?
    WHERE encounter_id = ?
  `).run(complaint ?? null, history ?? null, diagnosis ?? null, icd10_code ?? null,
         vitals ? JSON.stringify(vitals) : null,
         status ?? null, approvedAt ?? null, approvedBy ?? null, newVersion, now, req.params.enc_id);

  const action = status === 'approved' ? 'approve' : 'edit';
  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action, entity_type: 'encounter', entity_id: req.params.enc_id, patient_id: req.params.id });
  res.json({ success: true, version: newVersion });
});

// ── POST /patients/:id/encounters/:enc_id/prescriptions ────────
router.post('/:id/encounters/:enc_id/prescriptions', requireAuth, (req, res) => {
  const { prescription_id: clientRxId, drug_name, dosage, frequency, duration, route, source_snippet, confidence, status = 'active' } = req.body;
  if (!drug_name) return res.status(400).json({ error: 'drug_name is required' });

  const db = getDb();
  const prescription_id = clientRxId || `RX-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
  db.prepare(`
    INSERT INTO prescriptions
      (prescription_id, encounter_id, patient_id, drug_name, dosage, frequency, duration, route, confirmed, source_snippet, confidence, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
    ON CONFLICT(prescription_id) DO UPDATE SET
      drug_name = excluded.drug_name,
      dosage = excluded.dosage,
      frequency = excluded.frequency,
      duration = excluded.duration,
      route = excluded.route,
      confirmed = 1,
      status = excluded.status
  `).run(prescription_id, req.params.enc_id, req.params.id, drug_name,
         dosage || null, frequency || null, duration || null, route || null,
         source_snippet || null, confidence || 0.98, status, Date.now());

  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'create', entity_type: 'prescription', entity_id: prescription_id, patient_id: req.params.id });
  res.status(201).json({ prescription_id });
});

// ── POST /patients/:id/encounters/:enc_id/allergy-check ────────
// Check drug list against patient allergies — used from intake page.
router.post('/:id/encounters/:enc_id/allergy-check', requireAuth, (req, res) => {
  const { drug_names } = req.body;
  if (!Array.isArray(drug_names)) return res.status(400).json({ error: 'drug_names must be an array' });

  const conflicts = checkAllergies(req.params.id, drug_names);
  res.json({ patient_id: req.params.id, checked: drug_names.length, conflicts });
});

export default router;
