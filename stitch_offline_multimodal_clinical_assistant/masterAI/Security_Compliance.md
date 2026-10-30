# Security & Compliance - Data Privacy and Auditing (Swasthya Sync)

> Compliance note: this is a design reference, not a certification. The app serves India-based facilities, so the Digital Personal Data Protection Act 2023 and Ayushman Bharat Digital Mission (ABDM) requirements are the primary frameworks; HIPAA (a US law) and GDPR are useful reference points. Validate with legal/compliance counsel before handling real patient data. Use synthetic data in development.

---

## 1. Screen-Level Security Map
| Screen / control | Security requirement |
|---|---|
| S1 Doctor Login (ID + Local Vault Password, "Forgot Key?") | Key derivation (Argon2id), attempt throttling, no password echo by default, no prefilled credentials in production |
| S1 Quick PIN / biometric / dial pad | Hardware-bound key, strict attempt limits (section 2.3) |
| S1 "Trust this device for 12-hour offline shift" | Time-boxed session; absolute expiry; re-auth to extend |
| S1 Emergency Triage Bypass | Break-glass controls (section 6) |
| S1 Key Reset / SmartCard Issue, Register New Medical Officer | Admin-approved recovery; online verification |
| S2 Registration (licence verification, institutional email, passphrase, PIN, attestation) | Online-only; licence verified against registry; device key pair + certificate issued; attestation stored with timestamp |
| Header lock icon | Immediate lock: wipe keys and decrypted state |
| S5 Consent Protocol toggle | Consent captured before audio capture; audited; revocable |
| S4/S6 patient photo, ABHA id, guardian, phone, address | Encrypted at rest; photo and ABHA treated as identifiers |
| S4 Print / WhatsApp Rx, Generate District Referral | Data leaves the E2EE boundary: consent, minimization, audit (section 5) |
| S7 Confirming as "Dr. ... (Licence ...)" | Identity from session; resolution signed with device key |
| Allergy banner | Integrity-protected data (tamper-evident); never hidden |

---

## 2. Local Security (Offline)

### 2.1 Key hierarchy
```
Local vault password --(Argon2id, per-user salt, tuned for device)--> KEK
KEK --unwraps--> DEK (random 256-bit, versioned: key_version)
DEK --AES-256-GCM--> PHI fields, case files, attachments (audio/scans/photos), RAG chunks, outbox patches
Device key pair (ECDSA P-384, non-exportable where the platform allows) --> signs operations; wraps record keys (ECDH) for E2EE
```
- Keys created with WebCrypto or native keystores; DEKs stored only wrapped; KEK and DEK live in memory only while unlocked and are wiped on lock/timeout.

### 2.2 Encryption specification
| Item | Spec |
|---|---|
| Cipher | AES-256-GCM, 96-bit random IV per encryption, 128-bit tag |
| AAD | `entity_type|entity_id|version|key_version` binds ciphertext to its record |
| Envelope | `{v, key_version, iv, ciphertext, tag}` |
| Encrypted | Names, DOB, phone, address, guardian, ABHA id, allergies detail, transcripts, OCR text, case files, prescriptions, audio, images, photos, RAG chunks/embeddings, conflict snapshots, outbox patches |
| Plain (minimum) | ids, timestamps, versions, status, non-identifying routing metadata, blind-index tokens |
| Searchable encryption | Blind index = HMAC-SHA256 of normalized tokens using a separate index key; fuzzy matching done in memory after unlock |
| UI fields | Decrypted values only in component state while open; drafts autosaved encrypted; nothing in `localStorage`, URLs or caches; Service Worker caches only app shell and models |

### 2.3 PIN and biometric unlock
- A 6-digit PIN has only about 10^6 combinations, so it must **not** be the sole input to the data key. Design: the PIN unlocks a key held in the platform hardware keystore (or a wrapped key protected by it), with an attempt counter enforced by the hardware/OS where possible and by exponential lockout in software.
- After N wrong PINs (for example 5): require the full vault password; after more failures, require online re-authentication; optional local wipe at a policy threshold.
- Biometric is a convenience that releases the same hardware-bound key; it never replaces the vault password for first unlock of a shift or after reboot.
- The registration screen's "High (384-bit Entropic)" meter should be replaced by a real strength estimator and plain labels.

### 2.4 Sessions
- Normal session: unlocked by vault password; **shift trust** (12 h) is an absolute maximum, with shorter inactivity auto-lock (for example 2-5 minutes, configurable) and re-unlock by PIN/biometric.
- Emergency session: separate mode with reduced rights (section 6).
- Offline authorization uses a signed, time-limited entitlement token cached at login; expiry forces online re-auth after a configured window.

### 2.5 Retention, deletion
Audio purged after verified sync (configurable); right-to-erasure via tombstones and key destruction (crypto-shredding) for wiped devices; remote wipe on next contact for lost devices.

---

## 3. Transmission Security
| Control | Specification |
|---|---|
| Transport | TLS 1.2+ (prefer 1.3), HSTS, certificate validation (pinning on native), strict CSP, CORS allowlist |
| Auth | Short-lived JWT access tokens + rotating refresh tokens bound to `device_id`; refresh-reuse detection revokes the family |
| Device identity | Certificate issued at node provisioning ("Node Certificate Issued"); server checks the certificate and revocation list on every sync |
| Payload E2EE | Encrypt on device before entering the outbox; record keys wrapped per authorized user/device (envelope encryption); server stores ciphertext and wrapped keys but cannot decrypt |
| Request integrity | Signature over `(device_id, batch_id, ops digest, timestamp)`; stale timestamps and reused `batch_id` with different bodies rejected |
| Server-visible metadata | Entity id/type, versions, timestamps, pseudonymous patient id, per-field HMACs (for conflict detection) |
| Key lifecycle | Rotation increments `key_version`; revocation re-wraps keys; documented recovery (admin-held split secret) so a forgotten passphrase does not destroy data |
| Trade-off | E2EE prevents server-side merging and search; conflicts are detected by hash on the server and resolved on the client (see Sync doc) |

---

## 4. Claims on the Login Screen
| Displayed claim | Issue | Suggested wording |
|---|---|---|
| "HIPAA Compliant" | Not a certification a UI can assert; HIPAA is US-specific | "Encrypted on this device" |
| "FIPS 140-2" chip, "FIPS-140-2 Salted Vault" | Requires a validated cryptographic module; browser WebCrypto is not claimed to be validated | "AES-256 encrypted vault" (or claim FIPS only with a validated module) |
| "Local SHA-256" | Vague | Remove or explain as integrity checking |
| "Encrypted SQLite DB v4.12" | Internal detail | Move to Settings > About |
| "Mesh Peer: Active" | Peer sync not in core scope | Hide or label experimental |

---

## 5. Sharing and Output Documents [Extension]
**Print / WhatsApp Rx (HI/EN)** and **Generate District Referral** move PHI outside the encrypted system.
- Require patient consent for sharing (captured in the consent record); show a confirmation sheet naming the channel.
- Minimize content: prescription only for Rx; referral includes only clinically necessary fields; no internal ids or audit data.
- Prefer print/PDF handed to the patient; WhatsApp sharing should be patient-initiated to the patient's own number, with a warning that the message leaves the secure system.
- Log every share (who, what document, channel, time) in the audit trail; no PHI values in the log.

---

## 6. Emergency Triage Bypass (break-glass)
The design allows intake "without active doctor authentication credentials." Required controls:
| Control | Requirement |
|---|---|
| Scope | Create-only: can record vitals, complaints, and treatment; **cannot read** other patients' records or history (except the safety-critical allergy list if the patient is identified, as policy decides) |
| Reason | Mandatory reason selection (resuscitation, trauma shock, mass casualty) |
| Duration | Auto-expires (for example 30 minutes) and on device lock |
| Identity | Records tagged `EMERGENCY_BYPASS` with device id; anonymous temporary patient id |
| Audit | High-priority audit entries (start, every write, end); uploaded first on sync |
| Review | Supervisor review queue; an authenticated clinician must link and countersign records |
| Abuse prevention | Rate limit per device/day, alert on repeated use |

---

## 7. Consent
- The Consent Protocol toggle writes a `consents` record (patient, scope, state, given_by, timestamp, device) and an audit entry; recording is disabled when consent is not recorded.
- Withdrawal stops future processing and triggers deletion of stored audio per policy; consent state syncs to the server.
- Consent scopes: audio transcription, record sharing/printing, ABHA linkage **[Extension]**, data sync to the hospital.

---

## 8. Audit Logging

### 8.1 Events recorded
| Category | Examples from the UI |
|---|---|
| Auth/session | login, failed login, PIN/biometric unlock, lock, shift expiry, emergency bypass start/end, device registration |
| Record access | open patient chart, view history, view Local RAG Insights, view photo, search, export |
| Capture | consent given/withdrawn, recording started/stopped, scan added, manual notes saved |
| AI | transcription/OCR/extraction jobs (model version, job id, no content) |
| Review | section accepted, field edited (path only), diagnosis changed, medication accepted/rejected/removed, **allergy alert overridden with reason**, Doctor Verification, Save & Approve |
| Sync | batch pushed, op acked, retry, failure, "Sync Now" |
| Conflict | conflict detected, comparison viewed, **Keep This Clinic's Rx / Keep Hospital Center Rx / Combine Both** with per-item choices, resolver identity |
| Output | Rx printed/shared, referral generated |
| Admin | role change, key reset, remote wipe, key rotation |

### 8.2 Entry structure
```json
{
  "entry_id": "uuidv7",
  "device_id": "node-alpha-04",
  "seq": 1042,
  "ts_client": "2026-10-30T09:42:10+05:30",
  "ts_server": null,
  "actor": { "user_id": "u-77", "role": "clinician", "session_mode": "NORMAL" },
  "action": "CONFLICT_RESOLVED",
  "entity": { "type": "encounter", "id": "enc-9f2", "visit_ref": "ENC-9921", "patient_pseudo_id": "p-5d1" },
  "fields": ["prescriptions[paracetamol].frequency", "prescriptions[azithromycin]", "prescriptions[cetirizine]"],
  "detail": {
    "resolution": "COMBINE_BOTH",
    "item_choices": { "paracetamol.frequency": "SERVER_TID" },
    "safety_checks": { "allergy": "CLEAR", "duplication": "CLEAR", "max_daily_dose": "OK" },
    "base_version": 6, "server_version": 8, "new_version": 9
  },
  "prev_hash": "ab12...",
  "entry_hash": "SHA-256(prev_hash || canonical_json(entry))"
}
```
No PHI values: only ids, field paths, versions, action codes. Optional old/new value hashes prove change without disclosure.

### 8.3 Immutability
- **Local:** append-only, hash-chained per device, encrypted at rest, no update/delete path in the app.
- **Remote:** `audit_log` append-only (UPDATE/DELETE revoked), server timestamps and server-side chain; optional write-once export.

### 8.4 Offline to online
1. Entries accumulate while offline; chain continues without gaps.
2. On reconnect, `POST /audit/ingest` uploads first (priority 0), in order, idempotent by `entry_id`.
3. Server verifies chain continuity, monotonic `seq`, signature; a gap or mismatch creates a tamper/loss alert (itself audited).
4. Server acks the highest verified `seq`; client marks entries uploaded and keeps them per retention.
5. `GET /audit/verify?device_id=` lets admins re-verify any time; client clock is untrusted (`ts_server` authoritative).
6. Emergency-bypass entries are flagged for review.

### 8.5 Review tooling
Admin viewer (filter by patient pseudo-id, user, action, date), export for compliance, anomaly alerts (bulk exports, many charts opened, off-hours access, repeated bypass).

---

## 9. Threat Model Summary
| Threat | Mitigation |
|---|---|
| Lost/stolen tablet (shared "Tablet Node Alpha") | Encryption at rest, auto-lock, remote wipe, device revocation |
| Shoulder surfing at bedside | Auto-lock, screen privacy on app switch, PHI minimized in notifications |
| Weak PIN brute force | Hardware-bound key, lockouts, online re-auth |
| Insider snooping | Role checks, access audit, anomaly alerts |
| Tampered prescriptions/allergy list | Signed ops, version history, hash-chained audit |
| Network interception | TLS + E2EE payloads |
| Malicious client | Server-side authz, schema validation, rate limits, certificate checks |
| PHI in logs/telemetry | Redaction, no bodies logged |
| Model supply chain | Checksummed, signed model files |
| Shared-device cross-user leakage | Per-user keys; lock wipes memory; no shared caches |

---

## 10. Compliance Checklist (design-level)
- [ ] Encryption at rest and in transit; documented key management and recovery
- [ ] Unique user identity and licence verification
- [ ] Role-based access and minimum necessary access
- [ ] Consent capture, withdrawal, and sharing consent
- [ ] Audit controls with integrity verification
- [ ] Automatic logoff and shift expiry
- [ ] Break-glass procedure with review
- [ ] Data retention, deletion and erasure workflow
- [ ] Incident/breach response runbook (device revocation, key rotation, notification)
- [ ] Security testing and dependency scanning
- [ ] Legal review of claims shown in the UI
