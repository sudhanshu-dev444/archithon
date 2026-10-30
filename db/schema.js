// db/schema.js
// Creates and initialises the SQLite database using the built-in node:sqlite module
// (available in Node.js 22+, no native compilation required).

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'swasthya.db');

let db;

export function getDb() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    -- ----------------------------------------------------------------
    -- Devices (registered clinic nodes)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS devices (
      device_id     TEXT PRIMARY KEY,
      station_name  TEXT NOT NULL,
      registered_at INTEGER NOT NULL,
      revoked       INTEGER NOT NULL DEFAULT 0,
      revoked_at    INTEGER,
      revoked_by    TEXT
    );

    -- ----------------------------------------------------------------
    -- Doctors / clinicians
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS doctors (
      doctor_id       TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      email           TEXT UNIQUE NOT NULL,
      role            TEXT NOT NULL DEFAULT 'clinician',
      pin_hash        TEXT,
      passphrase_hash TEXT,
      council_number  TEXT,
      specialty       TEXT,
      created_at      INTEGER NOT NULL
    );

    -- ----------------------------------------------------------------
    -- Sessions
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS sessions (
      token_id    TEXT PRIMARY KEY,
      doctor_id   TEXT NOT NULL,
      device_id   TEXT NOT NULL,
      created_at  INTEGER NOT NULL,
      expires_at  INTEGER NOT NULL,
      revoked     INTEGER NOT NULL DEFAULT 0
    );

    -- ----------------------------------------------------------------
    -- Patients
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS patients (
      patient_id    TEXT PRIMARY KEY,
      abha          TEXT UNIQUE,
      name          TEXT NOT NULL,
      age           INTEGER,
      sex           TEXT,
      village       TEXT,
      ward          TEXT,
      phone         TEXT,
      condition     TEXT,
      triage        TEXT DEFAULT 'routine',
      summary       TEXT,
      version       INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );

    -- ----------------------------------------------------------------
    -- Patient allergies
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS allergies (
      allergy_id       TEXT PRIMARY KEY,
      patient_id       TEXT NOT NULL,
      name             TEXT NOT NULL,
      severity         TEXT,
      reaction         TEXT,
      cross_reactivity TEXT,
      recorded_by      TEXT,
      recorded_at      INTEGER NOT NULL
    );

    -- ----------------------------------------------------------------
    -- Encounters / consultations
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS encounters (
      encounter_id  TEXT PRIMARY KEY,
      patient_id    TEXT NOT NULL,
      doctor_id     TEXT,
      device_id     TEXT,
      encounter_ts  INTEGER NOT NULL,
      complaint     TEXT,
      history       TEXT,
      diagnosis     TEXT,
      icd10_code    TEXT,
      vitals        TEXT,
      status        TEXT NOT NULL DEFAULT 'draft',
      approved_by   TEXT,
      approved_at   INTEGER,
      version       INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );

    -- ----------------------------------------------------------------
    -- Prescriptions / medications per encounter
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS prescriptions (
      prescription_id TEXT PRIMARY KEY,
      encounter_id    TEXT NOT NULL,
      patient_id      TEXT NOT NULL,
      drug_name       TEXT NOT NULL,
      dosage          TEXT,
      frequency       TEXT,
      duration        TEXT,
      route           TEXT,
      confirmed       INTEGER NOT NULL DEFAULT 0,
      source_snippet  TEXT,
      confidence      REAL,
      status          TEXT NOT NULL DEFAULT 'active',
      created_at      INTEGER NOT NULL
    );

    -- ----------------------------------------------------------------
    -- Attachments (audio recordings, scans)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS attachments (
      attachment_id TEXT PRIMARY KEY,
      encounter_id  TEXT NOT NULL,
      patient_id    TEXT NOT NULL,
      type          TEXT NOT NULL,
      filename      TEXT NOT NULL,
      size_bytes    INTEGER,
      sha256        TEXT,
      upload_status TEXT NOT NULL DEFAULT 'pending',
      created_at    INTEGER NOT NULL
    );

    -- ----------------------------------------------------------------
    -- Entity version history (immutable, append-only)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS entity_versions (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type   TEXT NOT NULL,
      entity_id     TEXT NOT NULL,
      version       INTEGER NOT NULL,
      changed_by    TEXT,
      changed_at    INTEGER NOT NULL,
      field_path    TEXT,
      prev_value    TEXT,
      new_value     TEXT,
      op_id         TEXT
    );

    -- ----------------------------------------------------------------
    -- Sync: operation log (primary deliverable)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS sync_operations (
      op_id         TEXT PRIMARY KEY,
      device_id     TEXT NOT NULL,
      patient_id    TEXT NOT NULL,
      op_type       TEXT NOT NULL,
      entity_type   TEXT NOT NULL,
      entity_id     TEXT NOT NULL,
      field_path    TEXT,
      base_version  INTEGER NOT NULL DEFAULT 0,
      value_enc     TEXT,
      client_ts     INTEGER NOT NULL,
      server_ts     INTEGER,
      server_seq    INTEGER UNIQUE,
      status        TEXT NOT NULL DEFAULT 'pending',
      result_detail TEXT,
      priority      INTEGER NOT NULL DEFAULT 2,
      prev_hash     TEXT,
      hash          TEXT,
      resolves_conflict_id TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sync_ops_patient  ON sync_operations(patient_id);
    CREATE INDEX IF NOT EXISTS idx_sync_ops_entity   ON sync_operations(entity_id);
    CREATE INDEX IF NOT EXISTS idx_sync_ops_status   ON sync_operations(status);
    CREATE INDEX IF NOT EXISTS idx_sync_ops_seq      ON sync_operations(server_seq);

    -- ----------------------------------------------------------------
    -- Dedupe table: permanent idempotency record
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS processed_operations (
      op_id         TEXT PRIMARY KEY,
      received_at   INTEGER NOT NULL,
      status        TEXT NOT NULL,
      result_detail TEXT
    );

    -- ----------------------------------------------------------------
    -- Conflicts
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS conflicts (
      conflict_id     TEXT PRIMARY KEY,
      patient_id      TEXT NOT NULL,
      entity_type     TEXT NOT NULL,
      entity_id       TEXT NOT NULL,
      field_path      TEXT,
      op_a_id         TEXT NOT NULL,
      op_b_id         TEXT NOT NULL,
      version_a       INTEGER,
      version_b       INTEGER,
      value_enc_a     TEXT,
      value_enc_b     TEXT,
      base_value_enc  TEXT,
      status          TEXT NOT NULL DEFAULT 'open',
      resolved_by     TEXT,
      resolved_at     INTEGER,
      resolve_op_id   TEXT,
      created_at      INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_conflicts_patient ON conflicts(patient_id);
    CREATE INDEX IF NOT EXISTS idx_conflicts_status  ON conflicts(status);

    -- ----------------------------------------------------------------
    -- Audit log (hash-chained, append-only)
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS audit_log (
      audit_id    INTEGER PRIMARY KEY AUTOINCREMENT,
      op_id       TEXT,
      doctor_id   TEXT,
      device_id   TEXT,
      patient_id  TEXT,
      action      TEXT NOT NULL,
      entity_type TEXT,
      entity_id   TEXT,
      detail      TEXT,
      prev_hash   TEXT NOT NULL DEFAULT '',
      hash        TEXT NOT NULL,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_patient  ON audit_log(patient_id);
    CREATE INDEX IF NOT EXISTS idx_audit_doctor   ON audit_log(doctor_id);

    -- ----------------------------------------------------------------
    -- Sync pull cursors: per-device last pulled server_seq
    -- ----------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS pull_cursors (
      device_id     TEXT PRIMARY KEY,
      last_seq      INTEGER NOT NULL DEFAULT 0,
      updated_at    INTEGER NOT NULL
    );
  `);
}
