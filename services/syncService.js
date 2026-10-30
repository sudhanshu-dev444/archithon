// services/syncService.js
// Core sync engine: push, pull, conflict detection, idempotency.
// Uses node:sqlite (built into Node.js 22+) — no native compilation needed.

import { getDb } from '../db/schema.js';
import { appendAudit } from './auditService.js';
import { createHash } from 'crypto';

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function getNextServerSeq(db) {
  const row = db.prepare('SELECT MAX(server_seq) AS max_seq FROM sync_operations').get();
  return ((row?.max_seq) ?? 0) + 1;
}

function computeOpHash(op) {
  return createHash('sha256')
    .update(JSON.stringify({ op_id: op.op_id, device_id: op.device_id, entity_id: op.entity_id, value_enc: op.value_enc }))
    .digest('hex');
}

function safeParsePayload(valueEnc) {
  if (!valueEnc) return {};
  try { return JSON.parse(valueEnc); } catch { return {}; }
}

/**
 * Detect version conflict: does entity's current server version exceed base_version?
 * Returns { conflict: boolean, current_version: number, overlapping: boolean }
 */
function detectConflict(db, entityType, entityId, baseVersion, fieldPath) {
  let currentVersion = 0;
  if (entityType === 'patient') {
    const row = db.prepare('SELECT version FROM patients WHERE patient_id = ?').get(entityId);
    currentVersion = row?.version ?? 0;
  } else if (entityType === 'encounter') {
    const row = db.prepare('SELECT version FROM encounters WHERE encounter_id = ?').get(entityId);
    currentVersion = row?.version ?? 0;
  }

  if (baseVersion >= currentVersion) {
    return { conflict: false, current_version: currentVersion };
  }

  // Check if the same field was changed by a concurrent operation
  const concurrentOps = db.prepare(`
    SELECT field_path FROM sync_operations
    WHERE entity_id = ? AND server_seq > ? AND status IN ('applied', 'merged')
  `).all(entityId, baseVersion);

  const concurrentFields = new Set(concurrentOps.map(o => o.field_path).filter(Boolean));
  const overlapping = !fieldPath || concurrentFields.has(fieldPath) || concurrentFields.size === 0;

  return { conflict: true, current_version: currentVersion, overlapping };
}

/**
 * Write through to the entity tables based on op_type.
 * value_enc is stored encrypted; structural fields are updated.
 */
function applyToEntities(db, op) {
  const now = Date.now();
  const data = safeParsePayload(op.value_enc);

  if (op.op_type === 'CREATE') {
    if (op.entity_type === 'patient') {
      db.prepare(`
        INSERT OR IGNORE INTO patients
          (patient_id, abha, name, age, sex, village, ward, phone, condition, triage, summary, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(op.entity_id, data.abha ?? null, data.name ?? 'Unknown', data.age ?? null,
             data.sex ?? null, data.village ?? null, data.ward ?? null, data.phone ?? null,
             data.condition ?? null, data.triage ?? 'routine', data.summary ?? null, now, now);
    } else if (op.entity_type === 'encounter') {
      db.prepare(`
        INSERT OR IGNORE INTO encounters
          (encounter_id, patient_id, doctor_id, device_id, encounter_ts, complaint, history, diagnosis, icd10_code, vitals, status, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0, ?, ?)
      `).run(op.entity_id, op.patient_id, data.doctor_id ?? op.device_id, op.device_id,
             data.encounter_ts ?? now, data.complaint ?? null, data.history ?? null,
             data.diagnosis ?? null, data.icd10_code ?? null,
             data.vitals ? JSON.stringify(data.vitals) : null, now, now);
    } else if (op.entity_type === 'allergy') {
      db.prepare(`
        INSERT OR IGNORE INTO allergies (allergy_id, patient_id, name, severity, reaction, cross_reactivity, recorded_by, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(op.entity_id, op.patient_id, data.name ?? 'Unknown', data.severity ?? null,
             data.reaction ?? null, JSON.stringify(data.cross_reactivity ?? []), op.device_id, now);
    }
  } else if (op.op_type === 'UPDATE') {
    const newVersion = (op.base_version ?? 0) + 1;
    if (op.entity_type === 'patient') {
      db.prepare('UPDATE patients SET version = ?, updated_at = ? WHERE patient_id = ? AND version <= ?')
        .run(newVersion, now, op.entity_id, op.base_version ?? 0);
      db.prepare(`
        INSERT INTO entity_versions (entity_type, entity_id, version, changed_by, changed_at, field_path, new_value, op_id)
        VALUES ('patient', ?, ?, ?, ?, ?, ?, ?)
      `).run(op.entity_id, newVersion, op.device_id, now, op.field_path ?? null, op.value_enc ?? null, op.op_id);
    } else if (op.entity_type === 'encounter') {
      if (data.status === 'approved') {
        db.prepare(`UPDATE encounters SET status = 'approved', approved_at = ?, approved_by = ?, version = ?, updated_at = ? WHERE encounter_id = ?`)
          .run(now, op.device_id, newVersion, now, op.entity_id);
      } else {
        db.prepare('UPDATE encounters SET version = ?, updated_at = ? WHERE encounter_id = ? AND version <= ?')
          .run(newVersion, now, op.entity_id, op.base_version ?? 0);
      }
      db.prepare(`
        INSERT INTO entity_versions (entity_type, entity_id, version, changed_by, changed_at, field_path, new_value, op_id)
        VALUES ('encounter', ?, ?, ?, ?, ?, ?, ?)
      `).run(op.entity_id, newVersion, op.device_id, now, op.field_path ?? null, op.value_enc ?? null, op.op_id);
    }
  } else if (op.op_type === 'DELETE') {
    if (op.entity_type === 'encounter') {
      db.prepare("UPDATE encounters SET status = 'deleted', updated_at = ? WHERE encounter_id = ?").run(now, op.entity_id);
    }
  } else if (op.op_type === 'RESOLVE') {
    if (op.resolves_conflict_id) {
      db.prepare("UPDATE conflicts SET status = 'resolved', resolved_at = ?, resolve_op_id = ? WHERE conflict_id = ?")
        .run(now, op.op_id, op.resolves_conflict_id);
    }
  }
}

/**
 * Process a single operation.
 * Must be called inside a transaction.
 */
function processOp(db, op, deviceId, doctorId) {
  // 1. Idempotency check
  const processed = db.prepare('SELECT status, result_detail FROM processed_operations WHERE op_id = ?').get(op.op_id);
  if (processed) {
    return { status: 'duplicate', detail: processed.result_detail };
  }

  const serverSeq = getNextServerSeq(db);
  const serverTs  = Date.now();
  let status = 'pending';
  let detail = null;

  // 2. Conflict detection for UPDATE ops
  if (op.op_type === 'UPDATE') {
    const cd = detectConflict(db, op.entity_type, op.entity_id, op.base_version ?? 0, op.field_path);
    if (cd.conflict && cd.overlapping) {
      const conflictId = `CONF-${serverTs}-${Math.random().toString(36).slice(2, 7)}`;
      const existingOp = db.prepare(`
        SELECT op_id, value_enc, base_version FROM sync_operations
        WHERE entity_id = ? AND status = 'applied' ORDER BY server_seq DESC LIMIT 1
      `).get(op.entity_id);

      db.prepare(`
        INSERT INTO conflicts (conflict_id, patient_id, entity_type, entity_id, field_path, op_a_id, op_b_id, version_a, version_b, value_enc_a, value_enc_b, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)
      `).run(conflictId, op.patient_id, op.entity_type, op.entity_id, op.field_path ?? null,
             existingOp?.op_id ?? 'UNKNOWN', op.op_id,
             existingOp?.base_version ?? 0, op.base_version ?? 0,
             existingOp?.value_enc ?? null, op.value_enc ?? null, serverTs);

      status = 'conflict';
      detail = `Concurrent edit conflict — stored as ${conflictId}`;
    } else if (cd.conflict && !cd.overlapping) {
      status = 'merged';
      detail = 'Auto-merged: non-overlapping fields';
    }
  }

  if (status === 'pending') {
    try {
      applyToEntities(db, op);
      status = 'applied';
    } catch (err) {
      status = 'rejected';
      detail = err.message;
    }
  }

  // 3. Record in sync_operations
  db.prepare(`
    INSERT OR IGNORE INTO sync_operations
      (op_id, device_id, patient_id, op_type, entity_type, entity_id, field_path, base_version, value_enc, client_ts, server_ts, server_seq, status, result_detail, priority, prev_hash, hash, resolves_conflict_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    op.op_id, deviceId, op.patient_id, op.op_type, op.entity_type, op.entity_id,
    op.field_path ?? null, op.base_version ?? 0, op.value_enc ?? null,
    op.client_ts ?? serverTs, serverTs, serverSeq, status, detail ?? null,
    op.priority ?? 2, op.prev_hash ?? null, computeOpHash({ ...op, device_id: deviceId }),
    op.resolves_conflict_id ?? null
  );

  // 4. Record in processed_operations (idempotency table)
  db.prepare('INSERT OR IGNORE INTO processed_operations (op_id, received_at, status, result_detail) VALUES (?, ?, ?, ?)')
    .run(op.op_id, serverTs, status, detail ?? null);

  // 5. Audit
  appendAudit({
    op_id: op.op_id, doctor_id: doctorId, device_id: deviceId,
    patient_id: op.patient_id, action: op.op_type.toLowerCase(),
    entity_type: op.entity_type, entity_id: op.entity_id,
    detail: { status, field_path: op.field_path },
  });

  return { status, detail, server_seq: serverSeq };
}

// ---------------------------------------------------------------
// Public API
// ---------------------------------------------------------------

/**
 * POST /sync/push — process a batch of operations idempotently.
 */
export function pushOperations(operations, deviceId, doctorId) {
  const db = getDb();
  const results = [];

  for (const op of operations) {
    // node:sqlite transactions wrap a function
    let result;
    try {
      // node:sqlite doesn't expose .transaction(); use savepoints manually
      db.exec('SAVEPOINT sync_op');
      result = processOp(db, op, deviceId, doctorId);
      db.exec('RELEASE SAVEPOINT sync_op');
    } catch (err) {
      try { db.exec('ROLLBACK TO SAVEPOINT sync_op'); db.exec('RELEASE SAVEPOINT sync_op'); } catch {}
      result = { status: 'failed', detail: err.message };
    }
    results.push({ op_id: op.op_id, ...result });
  }

  return results;
}

/**
 * GET /sync/pull — return ops since device's last cursor.
 */
export function pullOperations(deviceId, since, limit = 50) {
  const db = getDb();
  const ops = db.prepare(`
    SELECT * FROM sync_operations
    WHERE server_seq > ? AND device_id != ?
    ORDER BY server_seq ASC LIMIT ?
  `).all(since ?? 0, deviceId, limit);

  if (ops.length > 0) {
    const newSeq = ops[ops.length - 1].server_seq;
    db.prepare(`
      INSERT INTO pull_cursors (device_id, last_seq, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET last_seq = excluded.last_seq, updated_at = excluded.updated_at
    `).run(deviceId, newSeq, Date.now());
  }

  return ops;
}

/**
 * GET /sync/verify — return patient version digest for convergence check.
 */
export function getVerifyDigest(patientId) {
  const db = getDb();
  const patient   = db.prepare('SELECT patient_id, version FROM patients WHERE patient_id = ?').get(patientId);
  const encounters = db.prepare('SELECT encounter_id, version FROM encounters WHERE patient_id = ?').all(patientId);
  const openConflicts = db.prepare("SELECT COUNT(*) AS cnt FROM conflicts WHERE patient_id = ? AND status = 'open'").get(patientId);

  return {
    patient_id: patientId,
    patient_version: patient?.version ?? null,
    encounters: encounters.map(e => ({ encounter_id: e.encounter_id, version: e.version })),
    open_conflicts: openConflicts?.cnt ?? 0,
    digest: createHash('sha256').update(JSON.stringify({ patient, encounters })).digest('hex'),
  };
}
