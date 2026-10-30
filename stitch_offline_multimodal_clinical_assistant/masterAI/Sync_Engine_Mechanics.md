# Sync Engine Mechanics - Offline-to-Online Synchronization (Swasthya Sync)

Guarantees: **no lost local changes, no duplicate effects, no silent overwrite, convergence across stations and the hospital.** The sync engine is the primary engineering deliverable.

---

## 1. UI Surface of the Sync Engine
| UI element | Source of truth |
|---|---|
| Header pill "Works offline • Saved on device" | `ConnectivityState` |
| "Sync Now" (S7 header) | Triggers a manual push+pull cycle; idempotent, safe to tap repeatedly (debounced, one cycle at a time) |
| "1 Record needs review" and Records tab badge | Count of open `conflicts` + permanently failed ops |
| Allergy banner tag "Blocked in Sync" | Entity has `BLOCKED`/`CONFLICT` ops; banner remains active |
| Per-record badges (S4 history, S7 list) | Newest op state for the entity (mapping in `PS04_Overview.md` section 6.2) |
| "Records Waiting to Sync" list | `sync_queue` grouped by entity: Visit & Triage Notes, Rapid Malaria Test Result, Vital Signs Check |
| "Pending Backhaul Sync" | Attachment/sample upload waiting |

---

## 2. Queue Lifecycle (from "Save & Approve Record")

### 2.1 Atomic local commit
Pressing **Save & Approve Record** (S6), **Stop & Save Note** (S5) or **Save & Confirm Patient Record** (S7) runs ONE local transaction:
1. Write the entity rows (case file VERIFIED, prescriptions, vitals, results).
2. Compute the field-level diff versus the last server-acknowledged version (`base_version`) and per-field HMACs.
3. Insert a `sync_queue` row per entity change: `op_id` (UUIDv7), `seq_no` (per-device monotonic), `op_type`, `base_version`, encrypted patch, `status = PENDING_SYNC`.
4. Append the hash-chained audit entry.
5. Update RAG chunks and `patient_summary`.
All or nothing; a crash cannot leave a record without its operation.

### 2.2 State machine
```
PENDING_SYNC -> IN_FLIGHT -> ACKED                       (applied | merged | duplicate)
     ^              |  timeout / 5xx / drop (same op_id)
     +--- backoff --+
IN_FLIGHT -> CONFLICT -> doctor resolves -> new RESOLVE op -> PENDING_SYNC
IN_FLIGHT -> FAILED  (permanent 4xx; visible reason, manual action)
PENDING_SYNC (same entity as a CONFLICT/FAILED op) -> BLOCKED -> PENDING_SYNC after resolution
```

### 2.3 Operation types and priority
| Priority | Operations | Rationale |
|---|---|---|
| 0 | Audit entries | Accountability first |
| 1 | Allergy additions / adverse events | Safety-critical, small |
| 2 | Encounters, case files, prescriptions, vitals, consents | Clinical record |
| 3 | POCT/lab results, referrals | Small structured data |
| 4 | Patient photo, audio, scans (attachments) | Large; chunked; optional Wi-Fi only |
Ordering: per device by `seq_no`; operations on one entity are serialized; different entities batch (about 20 ops or 256 KB).

---

## 3. Connectivity Detection
| Signal | Use |
|---|---|
| Browser/OS online-offline events | Hints |
| Authenticated lightweight `GET /health` probe with timeout | Ground truth (also validates token/TLS) |
| Hysteresis | Online after 2 consecutive successes, offline after 2 failures |
| Quality estimate | RTT/failure rate sets batch size and timeouts |
| Service Worker Background Sync | Wakes the sync even if the app is closed (where supported) |
| Foreground timer | Fallback (iOS Safari etc.) |
Triggers: connectivity regained, app foregrounded, new op while online, "Sync Now", periodic timer. On "Trust device for 12-hour offline shift" expiry the session locks but the outbox is retained and keeps syncing under the device credential.

---

## 4. Idempotency and Retry-Safety
| Identifier | Role |
|---|---|
| `op_id` (UUIDv7) | Unique per operation; **never regenerated on retry** |
| `batch_id` / `Idempotency-Key` | Request-level idempotency |
| `device_id` + device certificate | Registered node (issued at registration); ops are signed with the device key |
| `server_seq` | Server-assigned monotonically increasing change number for pull cursors |

**Client:** mark `IN_FLIGHT` before send; retain until an explicit ack; ambiguous failures retry with the same `op_id`; exponential backoff with jitter, attempt counter, circuit breaker; on restart `IN_FLIGHT` resets to `PENDING_SYNC`.

**Server (FastAPI + PostgreSQL), per operation in one transaction:**
1. Look up `processed_operations(op_id)`; if present, return the stored result unchanged (`duplicate`).
2. Validate (auth, device certificate, signature, schema, rate limit), apply or detect conflict, write `sync_changes` with a new `server_seq`.
3. Insert `processed_operations` (primary key on `op_id` makes racing duplicates safe).
"Committed but response lost" is harmless: the retry returns the stored result.

**Endpoints:** `POST /sync/push` (per-op results: applied, merged, duplicate, conflict, rejected), `GET /sync/pull?since=&limit=`, `GET /sync/verify?patient_id=`, `GET/POST /conflicts`, attachment init/chunk/complete, `POST /audit/ingest`, `GET /health`.

**Pull:** apply changes and advance the cursor in one local transaction; paginated and resumable; applies are idempotent by `(entity_id, version)`.

---

## 5. Version Tracking and Conflict Detection
Each server entity has `version`; `entity_versions` keeps full history (never rewritten). Updates carry `base_version`.

| Condition | Result |
|---|---|
| `base_version == server.version` | Apply, `version+1` |
| `base_version < server.version` | Concurrent edit: compare changed field sets using field paths and per-field HMACs (server cannot read E2EE content) |
| Non-overlapping changes in non-safety fields (for example demographics address vs phone) | Auto-merge, audit-logged |
| Overlapping fields with different values | **Conflict** (stored, not applied) |
| Update vs delete | Conflict |
| Duplicate patient create (same ABHA id / national id) | Conflict / merge-candidate review |
| Append-only data (vitals readings, attachments, notes) | Set-union by id |
| **Prescriptions / medication list** | **Always a conflict when both sides changed it** (clinical safety, as in the design) |
| **Allergies** | Additions always win (union); resolving or removing an allergy needs explicit clinician action plus a reason |
Because payloads are encrypted, the server only knows *that* and *where* a conflict exists; clients fetch the encrypted base/mine/server payloads and perform the content merge locally.

---

## 6. Conflict Resolution Workflow (S7 "Record Discrepancy - Needs Doctor Decision")

### 6.1 How the screen is built
Example in the design: Visit **#ENC-9921** for Sunita Devi.
| UI | Data |
|---|---|
| Card "This Clinic Station" (Today 09:30) | **Version A (Mine)**: local op payload: Paracetamol 650mg QDS + Azithromycin 500mg once daily x 3 days; reason "Suspected bacterial bronchitis" |
| Card "Hospital Center" (Today 08:45) | **Version B (Server)**: current server version: Paracetamol 650mg TID + Cetirizine 10mg nightly; reason "Allergic rhinorrhea & fever"; author, site, time from `entity_versions` |
| Explanation sentence | Generated from the field-level diff of `prescriptions` (added/changed/removed items on each side) |
| Chip "Penicillin / Amoxicillin auto-rejected via offline cross-check" | Allergy engine ran on both versions; any contraindicated item is pre-rejected and listed |
| Chip "Azithromycin in stock: n units" **[Extension]** | `stock_snapshot` with as-of time |
| Base version (not shown in the design; recommended as a collapsed "What each side changed" view) | `entity_versions[base_version]` so that "added" versus "changed" is clear |
Timestamp note: the hospital edit (08:45) precedes the clinic edit (09:30) because both started from the same base version; the order of edits does not decide the outcome.

### 6.2 Actions and exact data flow
| Button | Client steps | Resulting server state |
|---|---|---|
| **Keep This Clinic's Rx** | Build resolution = Version A prescription list; re-run safety checks; encrypt; create a `RESOLVE` op with `resolves_conflict_id` and `base_version = current server version` | New version with A's list; B retained in history; B's author notified on next pull |
| **Keep Hospital Center Rx** | Resolution = Version B list; local record replaced by server version; the local op is marked `RESOLVED_DISCARDED` (kept in audit, not deleted) | Conflict closed (version marker/bump) |
| **Combine Both Medicines** | Build a merged list (algorithm below); run checks; encrypt; `RESOLVE` op | New version with merged list |

**Combine Both algorithm (must be implemented per item, the design shows only a whole-prescription button):**
1. Normalize each item to ingredient + strength + route.
2. Items present on one side only (Azithromycin, Cetirizine) are added.
3. **Same ingredient on both sides with different instructions** (Paracetamol 650mg QDS vs TID) cannot be silently combined: show a small per-item chooser, "Paracetamol 650mg: choose QDS (clinic) / TID (hospital) / edit".
4. Run the allergy engine, duplicate-therapy check, maximum daily dose check (paracetamol total per day against the configured limit), stock check, and show the result as neutral rule output ("No allergy or duplication issues found"). **Remove the "Recommended clinical course" label**; the system should not recommend a clinical course.
5. Any contraindicated item blocks **Save & Confirm** until rejected or overridden with a reason.

### 6.3 Resolution rules (all actions)
1. "Confirming as: Dr. ... (Medical License ...)" is taken from the authenticated session, not editable; the op is signed with the device key and carries `resolved_by`.
2. The resolution op has its own `op_id` (idempotent) and goes through the normal queue.
3. The server re-checks `base_version == current`; if the record changed again, a **new conflict** is raised (no silent overwrite).
4. On success: conflict `RESOLVED`, new `server_seq`, audit entries (who, which items, which action, versions).
5. Other devices receive the resolved version on pull; their `BLOCKED` ops are rebased and released.
6. If the resolver lacks authority (for example not a prescriber), the op is rejected; optional supervisor review for overrides.
7. Not resolving does not block care: the clinic's own version stays usable locally, with the "Blocked in Sync" tag and banner reminder until resolved.

---

## 7. Special Cases from the Design
| Case | Handling |
|---|---|
| **Emergency Bypass records** | Anonymous create-only encounter with temporary id and `session.mode=EMERGENCY_BYPASS`; syncs as a `CREATE` flagged for review; an authenticated clinician later links it to a patient with a `LINK` op (merge-candidate workflow, audited) |
| **Offline patient registration (New Patient)** | Client UUID; duplicate detection on sync via ABHA/national id/name+DOB similarity; conflicts become merge-candidates |
| **Staff registration & node provisioning** | Online-only; not part of the outbox; produces device certificate used to sign ops |
| **POCT results (malaria RDT)** | Small structured op, priority 3; a positive result can raise a review prompt in the next sync/pull on other devices |
| **CBC sample "Pending Backhaul Sync"** | Attachment/result waiting for upload; does not block the encounter ack |
| **Print / WhatsApp Rx, Referral** **[Extension]** | Generated offline from the verified record; share event logged as an audit op; sending requires connectivity or a local print |
| **Stock snapshot** **[Extension]** | Pull-only, read-only cache with "as of" time; never conflicts |
| **Mesh Peer** **[Extension]** | If built: station-to-station exchange of the same signed, encrypted ops over local network; same idempotency and conflict rules; out of core scope |

---

## 8. Attachments
Resumable chunked upload with SHA-256; dedup by hash; ops reference attachments by id; the record is acked without waiting for blobs and shows "Pending Backhaul Sync" until uploaded; large files only on Wi-Fi if configured.

---

## 9. Verification and Diagnostics
- `GET /sync/verify?patient_id=` returns a digest/version map; client compares with local to prove convergence; mismatch triggers targeted re-pull.
- **Sync Inspector** (Settings, designed later): outbox, states, retry timers, cursor, errors, conflicts, failure-injection toggles (offline, flaky, duplicate delivery, timeout after commit).
- Server invariants: one `processed_operations` row per `op_id`; `server_seq` strictly increasing; contiguous `entity_versions`.

---

## 10. Edge Cases
| Case | Handling |
|---|---|
| Device clock wrong | Order by `server_seq`/`seq_no`; flag large skew; client time informational |
| Token expired mid-sync, offline for days | Ops stay queued; re-auth when online; shift trust expiry does not drop ops |
| Device revoked | Server rejects; client alerts, stops sync; optional remote wipe on contact |
| Very long offline period | Paginated resumable pull; snapshot + delta fallback |
| Storage full | Block new captures with a message; outbox never evicted |
| Partial batch failure | Per-op results; retry only failures |
| Schema version mismatch | Safe reject with upgrade-required; ops preserved |
| Sync Now tapped repeatedly | Single in-flight cycle; additional taps coalesced |
