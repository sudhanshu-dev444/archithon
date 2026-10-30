# Local Storage & Offline RAG - Persistence and Knowledge Retrieval (Swasthya Sync)

---

## 1. Storage Strategy
| Platform | Engine |
|---|---|
| PWA | IndexedDB (Dexie), OPFS/Cache Storage for blobs and models, `navigator.storage.persist()` requested |
| Mobile alternative | SQLite (SQLCipher or app-level field encryption) |

A `LocalStore` interface hides the engine. Every mutable row has: `id` (UUIDv7, client-generated), `version`, `base_version`, `updated_at`, `device_id`, `sync_status`, `deleted`, `key_version`. PHI columns are encrypted (`*_enc`); see `Security_Compliance.md`.

---

## 2. What Each Screen Reads and Writes

### 2.1 Patient Directory (S3)
| UI element | Local query |
|---|---|
| "248 Patients Cached" | `COUNT(patients)` in the station cache |
| Search (name, ID, condition) | Blind-index + in-memory fuzzy index over name, patient id, ABHA id, condition tags; results under 150 ms |
| Chips: All / Visited Today / Follow-ups Due | `last_visit_at` date filter; `followup_due_at <= today+N` (indexed) |
| Today's Triage Queue (Critical / Urgent / Routine, waiting time, status text) | `triage_queue` rows for today ordered by priority then arrival; waiting time computed from `arrived_at`; status derived (vitals logged, lab pending, chart ready) |
| Selected Patient Chart: vitals with [High] flags | Latest `vitals` row with computed flags |
| Clinical Summary + reference chips | RAG summary (section 5) cached per patient/version |
| All Cached Patients cards: last visit, key vital, follow-up days, active medication | Denormalized `patient_summary` row refreshed on every verified save |

**Cache scope (to decide):** the design shows 142 (login) vs 248 (directory). Define the rule: station roster + recently seen + follow-ups due + referrals, with a configurable cap and an "as of" sync timestamp. Patients outside the cache are only reachable online.

### 2.2 Patient Medical Record (S4)
| UI element | Local query |
|---|---|
| Identity, ward/village | `patients` |
| Vitals summary with trends ("Prev: 130/82 (14 May)", "up from 99.1F") | Latest two `vitals` rows per measurement; delta computed at read time |
| Allergy banner and card | `allergies` where `status=active`, highest severity first (never AI-derived) |
| Consultation History, filter chips All / Doctor Notes / Medications / Lab Reports | `encounters` + `case_files` + `prescriptions` + `lab_results`, `ORDER BY encounter_at DESC`; chip = `kind` filter |
| Per-card sync badge | newest `sync_queue` op for the entity |
| Today POCT results (Malaria RDT positive, CBC collected, RBS 110) | `lab_orders` + `lab_results`; CBC "Pending Backhaul Sync" = sample/attachment awaiting upload |
| Adverse drug event card (02 Feb 2025) | `encounters.kind=ADVERSE_EVENT` linked to the allergy row (`source_encounter_id`) |

### 2.3 Clinical Intake (S5) and Review (S6)
| Action | Writes |
|---|---|
| Consent toggle | `consents` row (patient, scope, state, by, at) |
| Stop & Save Note | `attachments` (audio, encrypted chunks) + `ai_jobs` |
| Scan | `attachments` (image original and processed) + OCR text in `text_feed` |
| Manual notes (autosave, encrypted) | `text_feed` row (`source=typed`) |
| Proceed to Review | `case_files` draft (`status=DRAFT`) |
| Save & Approve Record | One transaction: `case_files` VERIFIED + `prescriptions` + vitals + `sync_queue` op + `audit_local` + RAG chunks + `patient_summary` refresh |

### 2.4 Sync screen (S7)
`sync_queue` grouped by entity for "Records Waiting to Sync"; `conflicts` for the discrepancy card; `sync_state` for last sync time.

---

## 3. Local Schema (SQLite-style; Dexie stores mirror it)
```sql
CREATE TABLE patients (
  id TEXT PRIMARY KEY, mrn TEXT,
  name_enc BLOB NOT NULL, dob_enc BLOB, sex TEXT,
  phone_enc BLOB, address_enc BLOB, guardian_enc BLOB,
  abha_id_enc BLOB, abha_linked INTEGER DEFAULT 0,
  photo_ref TEXT,                       -- encrypted blob reference
  name_blind_idx TEXT, id_blind_idx TEXT,
  conditions_enc BLOB, follow_up_due_at TEXT, last_visit_at TEXT,
  consent_state TEXT,
  version INTEGER DEFAULT 0, base_version INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'LOCAL_ONLY', deleted INTEGER DEFAULT 0,
  key_version INTEGER NOT NULL, device_id TEXT NOT NULL,
  created_at TEXT, updated_at TEXT
);

CREATE TABLE allergies (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
  substance TEXT NOT NULL, drug_class TEXT, severity TEXT,   -- e.g. Penicillin, beta-lactam, CRITICAL
  reaction_enc BLOB, status TEXT DEFAULT 'active',            -- active | resolved_by_clinician
  source_encounter_id TEXT, recorded_by TEXT, recorded_at TEXT,
  version INTEGER DEFAULT 0, sync_status TEXT, key_version INTEGER, updated_at TEXT
);

CREATE TABLE encounters (
  id TEXT PRIMARY KEY, patient_id TEXT NOT NULL REFERENCES patients(id),
  visit_ref TEXT,                                            -- e.g. ENC-9921 (human-readable)
  kind TEXT,                                                 -- OPD | OUTREACH | EMERGENCY | ADVERSE_EVENT | LAB
  site TEXT, station_id TEXT, clinician_id TEXT NOT NULL,
  encounter_at TEXT NOT NULL,
  triage_level TEXT,                                         -- CRITICAL | URGENT | ROUTINE
  status TEXT DEFAULT 'DRAFT',                               -- DRAFT | VERIFIED
  version INTEGER DEFAULT 0, base_version INTEGER DEFAULT 0,
  sync_status TEXT DEFAULT 'LOCAL_ONLY', deleted INTEGER DEFAULT 0,
  key_version INTEGER, device_id TEXT, updated_at TEXT
);
CREATE INDEX idx_enc_patient_time ON encounters(patient_id, encounter_at DESC);

CREATE TABLE case_files (
  id TEXT PRIMARY KEY, encounter_id TEXT NOT NULL REFERENCES encounters(id),
  schema_version INTEGER, body_enc BLOB NOT NULL,            -- symptoms, diagnoses, follow-up, red flags
  field_hashes TEXT,                                         -- per-field HMACs for conflict detection
  section_state TEXT,                                        -- JSON: per section {accepted, edited_by, edited_at}
  ai_generated INTEGER DEFAULT 1, clinician_verified INTEGER DEFAULT 0,
  verified_by TEXT, verified_at TEXT,
  version INTEGER DEFAULT 0, base_version INTEGER DEFAULT 0, key_version INTEGER, updated_at TEXT
);

CREATE TABLE vitals (
  id TEXT PRIMARY KEY, patient_id TEXT, encounter_id TEXT,
  measured_at TEXT, recorded_by TEXT,
  bp_sys INTEGER, bp_dia INTEGER, hr INTEGER, temp_f REAL, spo2 INTEGER, resp_rate INTEGER, glucose_mgdl INTEGER,
  source TEXT,                                               -- MEASURED | DICTATED
  sync_status TEXT, version INTEGER, key_version INTEGER
);

CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY, encounter_id TEXT NOT NULL,
  drug_id TEXT, ingredient TEXT, name TEXT, strength TEXT, route TEXT,
  frequency TEXT, duration_days INTEGER, instructions_enc BLOB,
  state TEXT,                                                -- SUGGESTED | ACCEPTED | REJECTED | REMOVED
  rejected_reason TEXT, allergy_check TEXT,                  -- CLEAR | CAUTION | CONTRAINDICATED | OVERRIDDEN
  source TEXT,                                               -- SLIP | DICTATION | MANUAL
  version INTEGER, key_version INTEGER
);

CREATE TABLE lab_orders (id TEXT PRIMARY KEY, encounter_id TEXT, test_code TEXT, kind TEXT, -- POCT | LAB
  state TEXT, ordered_at TEXT);                              -- [Extension]
CREATE TABLE lab_results (id TEXT PRIMARY KEY, order_id TEXT, result_enc BLOB, flag TEXT,
  collected_at TEXT, attachment_id TEXT, sync_status TEXT);

CREATE TABLE formulary (id TEXT PRIMARY KEY, ingredient TEXT, brand_names TEXT, drug_class TEXT,
  allergen_classes TEXT, form TEXT, strength TEXT, max_daily_mg INTEGER, alt_group TEXT);
CREATE TABLE stock_snapshot (drug_id TEXT, station_id TEXT, units INTEGER, as_of TEXT);  -- [Extension] read-only cache

CREATE TABLE triage_queue (id TEXT PRIMARY KEY, patient_id TEXT, encounter_id TEXT,
  level TEXT, arrived_at TEXT, status TEXT, summary_enc BLOB);

CREATE TABLE consents (id TEXT PRIMARY KEY, patient_id TEXT, scope TEXT, state TEXT,
  given_by TEXT, at TEXT, device_id TEXT, version INTEGER, sync_status TEXT);

CREATE TABLE attachments (id TEXT PRIMARY KEY, encounter_id TEXT, kind TEXT,    -- AUDIO | IMAGE | PDF | PHOTO
  blob_ref TEXT, sha256 TEXT, bytes INTEGER, upload_state TEXT DEFAULT 'LOCAL', created_at TEXT);

CREATE TABLE text_feed (id TEXT PRIMARY KEY, encounter_id TEXT, source TEXT,    -- voice | ocr | typed
  text_enc BLOB, lang TEXT, start_ms INTEGER, end_ms INTEGER, bbox TEXT,
  confidence REAL, attachment_id TEXT, edited INTEGER DEFAULT 0);

CREATE TABLE referrals (id TEXT PRIMARY KEY, patient_id TEXT, encounter_id TEXT, to_facility TEXT,
  body_enc BLOB, state TEXT);                                                   -- [Extension]

CREATE TABLE chunks (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, encounter_id TEXT NOT NULL,
  section TEXT, text_enc BLOB, embedding_enc BLOB, source_version INTEGER, created_at TEXT);
CREATE INDEX idx_chunks_patient ON chunks(patient_id);

CREATE TABLE ai_jobs (id TEXT PRIMARY KEY, type TEXT, input_ref TEXT, status TEXT,
  attempts INTEGER DEFAULT 0, error TEXT, created_at TEXT, updated_at TEXT);

CREATE TABLE sync_queue (
  op_id TEXT PRIMARY KEY, seq_no INTEGER NOT NULL, device_id TEXT NOT NULL,
  entity_type TEXT, entity_id TEXT, op_type TEXT,            -- CREATE | UPDATE | DELETE | ATTACH | RESOLVE
  base_version INTEGER, patch_enc BLOB, changed_fields TEXT,
  status TEXT DEFAULT 'PENDING_SYNC',                        -- PENDING_SYNC | IN_FLIGHT | ACKED | CONFLICT | BLOCKED | FAILED
  priority INTEGER DEFAULT 5, attempts INTEGER DEFAULT 0, next_retry_at TEXT, last_error TEXT, created_at TEXT
);
CREATE INDEX idx_queue ON sync_queue(status, priority, seq_no);

CREATE TABLE sync_state (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE conflicts (id TEXT PRIMARY KEY, entity_type TEXT, entity_id TEXT, op_id TEXT,
  base_enc BLOB, mine_enc BLOB, server_enc BLOB, server_author TEXT, server_site TEXT, server_at TEXT,
  status TEXT DEFAULT 'OPEN', resolution TEXT, resolved_by TEXT, resolved_at TEXT);
CREATE TABLE audit_local (id TEXT PRIMARY KEY, seq INTEGER, ts TEXT, actor TEXT, action TEXT,
  entity_type TEXT, entity_id TEXT, field_paths TEXT, meta TEXT, prev_hash TEXT, entry_hash TEXT, uploaded INTEGER DEFAULT 0);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, mode TEXT,   -- NORMAL | EMERGENCY_BYPASS
  started_at TEXT, expires_at TEXT, device_id TEXT);
CREATE TABLE patient_summary (patient_id TEXT PRIMARY KEY, last_visit_at TEXT, key_vital TEXT, active_meds TEXT,
  follow_up_due_at TEXT, rag_summary_enc BLOB, summary_for_version INTEGER);
```

---

## 4. Derived Values Shown in the UI
| UI value | Rule |
|---|---|
| Vital flags (High - Fever, Stage 1, Normal) | Deterministic thresholds in a versioned rules table; clinician-visible, not AI |
| Trend arrows | Compare with previous measurement of the same type; show previous value and date |
| "Checked 15m ago" | `now - measured_at` |
| Waiting time in triage queue | `now - arrived_at` |
| Follow-up "6 Days" | `follow_up_due_at - today` |
| "Last updated" | Max `updated_at` over the patient's chart rows |
| "In stock (n units)" **[Extension]** | `stock_snapshot.units` with `as_of` shown on tap; if older than a threshold show "stock as of dd/mm" in amber |

---

## 5. Offline RAG Engine (S3 Clinical Summary, S4 Local RAG Insights)

### 5.1 Goal
Provide the clinician (and the extraction prompt) with relevant, cited history from the selected patient only, offline.

### 5.2 Indexing (write path)
Triggered when a case file becomes **VERIFIED** (drafts are not history).
1. Chunk by section: allergies/adverse events, complaints+HPI, vitals snapshot, diagnoses, medications, lab/POCT results, follow-up, OCR text of attached reports. Target 150-300 tokens with metadata `{patient_id, encounter_id, visit_date, section, version}`.
2. Keyword index (BM25) with medical synonym expansion (HTN = hypertension, DM = diabetes, Hindi common terms).
3. Optional embeddings (small on-device model) computed in an idle worker; keyword search works before vectors exist.
4. Chunk text and vectors are encrypted at rest; the in-memory index is built after unlock.
5. Re-index when the source version changes; remove chunks for tombstoned records.

### 5.3 Retrieval (read path)
1. Query = current complaint + latest transcript text + current medication names (or the patient's chart context for "Local RAG Insights").
2. **Hard filter `patient_id`**. No cross-patient retrieval for clinical summaries.
3. Hybrid search (BM25 + cosine), fused with Reciprocal Rank Fusion.
4. Rerank: recency decay; boost allergies, active medications, chronic conditions, recent adverse events.
5. **Always include** active allergies, adverse events and current medications even if not retrieved.
6. Assemble context within a token budget, each snippet labelled `[visit_ref / section / date]`.

### 5.4 Generation and presentation
- LLM writes the summary (for example "42-year-old female with mild hypertension and seasonal rhinitis ... verified penicillin allergy") as short statements; each statement must reference at least one snippet.
- UI renders references as chips: "From Visit 14 May 2025", "From Visit 02 Feb 2025"; tapping opens the source encounter.
- Post-check removes or flags uncited sentences. If retrieval is empty: "No prior history on this device."
- Cache in `patient_summary` keyed by the latest verified version; regenerate in the background after a new verified save or a pull that changes the patient.
- Local RAG Insights (S4) can expose extra panels: allergy and adverse events, medication history, vitals trends, previous diagnoses, with the same citation rule.

### 5.5 Two uses
| Use | Surface |
|---|---|
| Summary for the clinician | S3 Clinical Summary, S4 Local RAG Insights |
| Context for extraction | Informs S6 draft (e.g. detect allergy conflicts, recognise "same medicine as last visit") |

---

## 6. Storage Management and Integrity
| Concern | Policy |
|---|---|
| Quota | `storage.estimate()`; warn at 80%; at critical level block new audio/scans, never block typed notes or the allergy banner |
| Purge | Audio after verification and sync (configurable); synced attachments evictable and re-fetchable; outbox, allergies and audit never evicted |
| Migrations | Versioned, rollback-safe, with automatic pre-migration backup of `sync_queue` and `audit_local` |
| Backup | Optional encrypted export to removable media for stations with no connectivity |
| Consistency checks | Periodic scan: orphan chunks/attachments, dangling references, checksum verification |
| Emergency records | Anonymous bypass encounters stored with `patient_id = NULL` + temporary identifiers until linked (see Sync doc) |
