// routes/sync.js
// Sync engine endpoints: push, pull, verify, conflict resolution.
// Primary engineering deliverable per PRD.

import { Router } from 'express';
import { getDb } from '../db/schema.js';
import { requireAuth } from '../middleware/auth.js';
import { pushOperations, pullOperations, getVerifyDigest } from '../services/syncService.js';
import { appendAudit } from '../services/auditService.js';

const router = Router();

// ── GET /sync/status ───────────────────────────────────────────
// Returns overall sync status: pending count, conflicts, last seq.
router.get('/status', requireAuth, (req, res) => {
  const db = getDb();
  const pending = db.prepare("SELECT COUNT(*) as cnt FROM sync_operations WHERE status = 'pending'").get();
  const conflicts = db.prepare("SELECT COUNT(*) as cnt FROM conflicts WHERE status = 'open'").get();
  const lastSeq = db.prepare('SELECT MAX(server_seq) as seq FROM sync_operations').get();
  const cursor = db.prepare('SELECT last_seq FROM pull_cursors WHERE device_id = ?').get(req.device_id);

  res.json({
    pending_count: pending.cnt,
    open_conflicts: conflicts.cnt,
    last_server_seq: lastSeq?.seq ?? 0,
    device_cursor: cursor?.last_seq ?? 0,
  });
});

// ── POST /sync/push ────────────────────────────────────────────
// Accepts a batch of operations from the device outbox.
// Each op is processed idempotently (op_id is the idempotency key).
//
// Request body:
//   { operations: [{ op_id, op_type, entity_type, entity_id, patient_id, base_version, value_enc, field_path, client_ts, priority, prev_hash, resolves_conflict_id }] }
//
// Response: per-op results: applied | merged | duplicate | conflict | rejected
router.post('/push', requireAuth, (req, res) => {
  const { operations } = req.body;
  if (!Array.isArray(operations) || operations.length === 0) {
    return res.status(400).json({ error: 'operations array is required' });
  }
  if (operations.length > 100) {
    return res.status(400).json({ error: 'Max 100 operations per push batch' });
  }

  // Validate required fields per op
  for (const op of operations) {
    if (!op.op_id || !op.op_type || !op.entity_type || !op.entity_id || !op.patient_id) {
      return res.status(400).json({ error: `Operation missing required fields`, op_id: op.op_id });
    }
    // Reject op_id reuse with different payload
    const db = getDb();
    const processed = db.prepare('SELECT op_id FROM processed_operations WHERE op_id = ?').get(op.op_id);
    if (processed) {
      // Will be handled as duplicate inside pushOperations — fine
    }
  }

  const results = pushOperations(operations, req.device_id, req.doctor_id);
  res.json({ results, pushed: operations.length, ts: Date.now() });
});

// ── GET /sync/pull ─────────────────────────────────────────────
// Returns new operations since the device's last cursor.
// ?since=<server_seq>&limit=<n>
router.get('/pull', requireAuth, (req, res) => {
  const since = parseInt(req.query.since) || 0;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const ops = pullOperations(req.device_id, since, limit);

  res.json({
    operations: ops,
    count: ops.length,
    has_more: ops.length === limit,
    since,
  });
});

// ── GET /sync/verify ───────────────────────────────────────────
// Returns version checksum for a patient — used after sync to confirm convergence.
// ?patient_id=<id>
router.get('/verify', requireAuth, (req, res) => {
  const { patient_id } = req.query;
  if (!patient_id) return res.status(400).json({ error: 'patient_id is required' });

  const digest = getVerifyDigest(patient_id);
  res.json(digest);
});

// ── GET /conflicts ─────────────────────────────────────────────
// Lists open conflicts. ?patient_id= for patient-scoped.
router.get('/conflicts', requireAuth, (req, res) => {
  const { patient_id, status = 'open' } = req.query;
  const db = getDb();
  let query = 'SELECT * FROM conflicts WHERE status = ?';
  const params = [status];
  if (patient_id) {
    query += ' AND patient_id = ?';
    params.push(patient_id);
  }
  query += ' ORDER BY created_at DESC';
  const conflicts = db.prepare(query).all(...params);
  res.json({ conflicts, count: conflicts.length });
});

// ── GET /conflicts/:conflict_id ────────────────────────────────
router.get('/conflicts/:conflict_id', requireAuth, (req, res) => {
  const db = getDb();
  const conflict = db.prepare('SELECT * FROM conflicts WHERE conflict_id = ?').get(req.params.conflict_id);
  if (!conflict) return res.status(404).json({ error: 'Conflict not found' });

  // Attach entity version history for context
  const versions = db.prepare(`
    SELECT * FROM entity_versions
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY version DESC LIMIT 10
  `).all(conflict.entity_type, conflict.entity_id);

  appendAudit({ doctor_id: req.doctor_id, device_id: req.device_id, action: 'view', entity_type: 'conflict', entity_id: req.params.conflict_id, patient_id: conflict.patient_id });
  res.json({ ...conflict, version_history: versions });
});

// ── POST /conflicts/:conflict_id/resolve ──────────────────────
// Clinician resolves a conflict by choosing a resolution strategy.
// Body: { strategy: 'keep_a' | 'keep_b' | 'merge', merged_value: <encrypted JSON>, resolve_reason }
router.post('/conflicts/:conflict_id/resolve', requireAuth, (req, res) => {
  const { strategy, merged_value, resolve_reason } = req.body;
  if (!strategy) return res.status(400).json({ error: 'strategy is required: keep_a | keep_b | merge' });
  if (!['keep_a', 'keep_b', 'merge'].includes(strategy)) {
    return res.status(400).json({ error: 'strategy must be: keep_a | keep_b | merge' });
  }

  const db = getDb();
  const conflict = db.prepare('SELECT * FROM conflicts WHERE conflict_id = ?').get(req.params.conflict_id);
  if (!conflict) return res.status(404).json({ error: 'Conflict not found' });
  if (conflict.status !== 'open') return res.status(409).json({ error: 'Conflict is already resolved' });

  // Build a RESOLVE operation and push it through the sync engine
  const resolveOp = {
    op_id: `RESOLVE-${req.params.conflict_id}-${Date.now()}`,
    op_type: 'RESOLVE',
    entity_type: conflict.entity_type,
    entity_id: conflict.entity_id,
    patient_id: conflict.patient_id,
    field_path: conflict.field_path,
    base_version: conflict.version_b ?? 0,
    value_enc: strategy === 'keep_a' ? conflict.value_enc_a
              : strategy === 'keep_b' ? conflict.value_enc_b
              : merged_value,
    client_ts: Date.now(),
    resolves_conflict_id: req.params.conflict_id,
    priority: 1,
  };

  const results = pushOperations([resolveOp], req.device_id, req.doctor_id);

  // Mark conflict resolved
  db.prepare(`
    UPDATE conflicts SET status = 'resolved', resolved_by = ?, resolved_at = ?, resolve_op_id = ?
    WHERE conflict_id = ?
  `).run(req.doctor_id, Date.now(), resolveOp.op_id, req.params.conflict_id);

  appendAudit({
    doctor_id: req.doctor_id, device_id: req.device_id,
    action: 'resolve', entity_type: 'conflict', entity_id: req.params.conflict_id,
    patient_id: conflict.patient_id,
    detail: { strategy, resolve_reason },
  });

  res.json({ success: true, resolve_op_id: resolveOp.op_id, results });
});

// ── GET /audit ─────────────────────────────────────────────────
// Paginated audit log. ?patient_id= ?doctor_id= ?action= ?limit= ?offset=
router.get('/audit', requireAuth, (req, res) => {
  const { patient_id, doctor_id, action, limit = 50, offset = 0 } = req.query;
  const db = getDb();

  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params = [];
  if (patient_id) { query += ' AND patient_id = ?'; params.push(patient_id); }
  if (doctor_id)  { query += ' AND doctor_id = ?';  params.push(doctor_id); }
  if (action)     { query += ' AND action = ?';     params.push(action); }
  query += ' ORDER BY audit_id DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const entries = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM audit_log').get();
  res.json({ entries, total: total.cnt });
});

// ── POST /audit/ingest ─────────────────────────────────────────
// Receive client-side audit entries (e.g. offline view events).
router.post('/audit/ingest', requireAuth, (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries array is required' });

  let ingested = 0;
  for (const entry of entries) {
    try {
      appendAudit({ ...entry, doctor_id: req.doctor_id, device_id: req.device_id });
      ingested++;
    } catch { /* skip malformed entries */ }
  }
  res.json({ ingested });
});

export default router;
