// services/auditService.js
// Hash-chained audit log writer.

import { getDb } from '../db/schema.js';
import { createHash } from 'crypto';

/**
 * Appends an entry to the audit log.
 * Each entry hashes the previous entry's hash + its own content
 * to form a tamper-evident chain.
 */
export function appendAudit({ op_id, doctor_id, device_id, patient_id, action, entity_type, entity_id, detail }) {
  const db = getDb();
  const now = Date.now();

  // Get last audit hash for the chain
  const last = db.prepare('SELECT hash FROM audit_log ORDER BY audit_id DESC LIMIT 1').get();
  const prev_hash = last?.hash ?? '';

  // Compute this entry's hash
  const content = JSON.stringify({ op_id, doctor_id, device_id, patient_id, action, entity_type, entity_id, detail, created_at: now });
  const hash = createHash('sha256').update(prev_hash + content).digest('hex');

  db.prepare(`
    INSERT INTO audit_log
      (op_id, doctor_id, device_id, patient_id, action, entity_type, entity_id, detail, prev_hash, hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    op_id ?? null,
    doctor_id ?? null,
    device_id ?? null,
    patient_id ?? null,
    action ?? 'unknown',
    entity_type ?? null,
    entity_id ?? null,
    detail ? JSON.stringify(detail) : null,
    prev_hash ?? '',
    hash,
    now
  );
}

