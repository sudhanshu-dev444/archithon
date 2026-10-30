# Evaluation Metrics - System Performance and Testing Plan (Swasthya Sync)

Success is judged on offline usability, extraction accuracy, synchronization reliability, conflict handling, data integrity, and performance on resource-constrained devices. Targets are **proposed thresholds** to be confirmed on reference devices. All test data must be synthetic.

---

## 1. Reference Environment
| Tier | Profile |
|---|---|
| Low-end | Android phone, 3 GB RAM, entry-level CPU, 32 GB storage, Chrome PWA (and native build if used) |
| Mid | Android tablet, 6 GB RAM ("Tablet Node Alpha" class) |
| Desktop | Clinic workstation, 8 GB RAM |
Network profiles: offline, 2G (~50 kbps, 800 ms RTT), slow 3G, flaky (10-30% loss), intermittent (30 s up / 30 s down).

---

## 2. Offline Usability

### 2.1 Responsiveness per screen (low-end device)
| Screen / action | Metric | Target |
|---|---|---|
| Cold start to login screen (installed, offline) | Time | <= 3 s |
| Sign-in to directory ("INITIALIZING LOCAL DATABASE...") | Time | <= 3 s vault password; <= 1 s PIN/biometric |
| Directory search (248 patients; stress 10k) | Keystroke to results | <= 150 ms p95 |
| Open patient chart with 500 encounters | First paint | <= 300 ms |
| Allergy banner display on any patient screen | After patient selected | <= 100 ms, 100% presence |
| Start recording (button to capture) | Latency | <= 500 ms |
| Waveform/timer | Frame rate during transcription | >= 24 fps, no dropped timer ticks |
| Proceed to Review to S6 shown (draft or manual fallback) | Time to interactive | <= 2 s (draft may stream in after) |
| S6 interaction (Edit/Accept) | Input latency | <= 100 ms |
| Save & Approve Record (local commit) | Time | <= 500 ms |
| Sync Now tap to visible state change | Time | <= 200 ms |
| INP | p75 | <= 200 ms |
| Memory with Lite AI profile | Peak | < 1.2 GB total |

### 2.2 Offline completeness
With the network disabled for the whole session, the following must all succeed (100%): sign in, search patient, open chart, view allergies and history, start consultation, record consent, record voice, scan slip, type notes, review, resolve an allergy conflict, verify and save, print Rx **[Extension]**, create new patient, lock/unlock. Reload and kill the app mid-session: no data loss.

### 2.3 Usability tasks (synthetic patient "Sunita Devi")
| Task | Success criterion |
|---|---|
| T1 Find the patient and identify the allergy | < 15 s, 100% notice the banner |
| T2 Record a 60 s consultation and stop | First attempt success >= 90% |
| T3 Scan a slip and resolve the Amoxicillin conflict by adopting Azithromycin | >= 95% choose a safe path; 0 unsafe saves |
| T4 Edit one AI-suggested section and approve | < 2 min |
| T5 Understand sync state ("Ready to send", "Sync pending") | >= 90% correct explanation |
| T6 Resolve the ENC-9921 discrepancy using Combine Both, including the paracetamol frequency choice | >= 90% correct outcome |
| T7 Use the app one-handed with gloves/sunlight simulation | No mis-taps on 48px targets beyond 2% |
| T8 Repeat T2-T4 in Hindi | Parity with English within 15% time |
Overall: SUS score >= 75 (pilot n >= 5 clinicians); time per consultation at least 40% lower than the paper baseline; text contrast >= 4.5:1 (WCAG AA) and touch targets >= 48 px verified by an automated audit.

---

## 3. AI Accuracy

### 3.1 Speech (Whisper.cpp)
| Metric | Definition | Target |
|---|---|---|
| WER | (S + D + I) / reference words after normalization | English clinical dictation <= 15% Lite, <= 10% Standard; Hindi <= 25% (report baseline); code-mixed Hindi-English reported separately |
| Medical-term error rate | Errors on a curated drug/condition list | <= 15% |
| Real-time factor | processing time / audio time | <= 1.0 Lite on low-end |
| Chunk boundary errors | Duplicates/omissions at overlaps | < 1% of boundaries |
| Model load time | Cold | <= 10 s Lite |
Dataset: 30+ synthetic/consented de-identified consultations, varied accents and noise (clinic, outdoor), at least English and Hindi, human-verified transcripts. Report per language and noise level.

### 3.2 OCR (prescription slips and reports)
| Metric | Target |
|---|---|
| CER, printed prescriptions/reports | <= 3% |
| Word accuracy, printed | >= 92% |
| Drug name exact/fuzzy-correct after formulary match | >= 90% printed; handwriting reported as baseline |
| Strength/frequency/duration extraction ("500mg TDS") | >= 95% printed |
| Time per page (low-end) | <= 8 s |
| Low-confidence flag recall (errors that were flagged) | >= 70% |
Dataset: 50+ synthetic printed slips/reports photographed with skew, glare, blur; a handwritten set for baseline.

### 3.3 LLM extraction (S6 fields)
Gold set: 100 synthetic encounters (dictation + slip + typed notes) with expert-labelled JSON.
| Metric | Target |
|---|---|
| Field-level precision | >= 90% overall |
| Field-level recall | >= 85% overall |
| Medications (name + strength + frequency all correct) | >= 90% |
| Symptoms/complaints F1 | >= 85% |
| Follow-up instructions F1 | >= 85% |
| ICD-10 suggestion acceptance (clinician accepts without change) | Report; target >= 70% for symptom codes |
| Hallucination rate (values unsupported by sources) | <= 2% (critical) |
| Schema validity first pass / after repair+fallback | >= 95% / 100% |
| Provenance validity (source_ref supports value) | >= 95% |
| Vitals mismatch flagging (dictated vs measured) | >= 95% |
| Latency, 500-word input to filled form (low-end) | <= 60 s Lite |

### 3.4 Safety rules (deterministic)
| Metric | Target |
|---|---|
| Drug-allergy conflict recall on a labelled set (brand/generic/class, misspellings, OCR noise) | **100%** (0 false negatives in the test set) |
| False positive rate | Report; <= 5% |
| Duplicate therapy and daily-dose check accuracy | 100% on rule test set |
| Unsafe Save & Approve possible with unresolved contraindicated item | 0 |
| Diagnosis auto-changed by the system after new lab result | 0 (prompt only) |

### 3.5 RAG
| Metric | Target |
|---|---|
| Recall@5 of relevant historical chunks (50 labelled queries) | >= 85% |
| Cross-patient leakage | 0 |
| Citation correctness | >= 95% |
| Unsupported statements in summary | <= 3% |
| Allergy/adverse-event inclusion in every summary | 100% |
| Retrieval latency (10k chunks, patient-filtered) | <= 200 ms p95 |
| "No history" behaviour when empty | 100% |

### 3.6 Human-in-the-loop
Track edit rate per section, rejection rate, time-to-verify, and verify-without-edit rate. No draft may reach VERIFIED without explicit Doctor Verification (0 bypasses).

---

## 4. Sync and Stress Testing

### 4.1 Test cases
| ID | Scenario | Expected result |
|---|---|---|
| S-01 | 50 records created offline, then online | All delivered once; digests match |
| S-02 | **Abrupt network failure mid-push** (drop connection at 50% of a batch) | Acked ops stay acked; unacked retried with same `op_id`; final state equals an uninterrupted run |
| S-03 | Server commits, response lost | Retry returns stored result; one effect |
| S-04 | Same `op_id` delivered 10 times concurrently | One applied, nine `duplicate` |
| S-05 | App killed while `IN_FLIGHT` | Returns to `PENDING_SYNC`; no loss |
| S-06 | "Sync Now" tapped 10 times quickly | Single cycle; no duplicates |
| S-07 | Two sites edit different demographic fields | Auto-merge, audited |
| S-08 | **ENC-9921 replica:** clinic and hospital both change prescriptions | Conflict raised; neither lost; S7 shows A vs B |
| S-09 | Keep This Clinic's Rx / Keep Hospital Center Rx | Correct final list, new version, history kept, audit, other device converges |
| S-10 | **Combine Both** where paracetamol differs (QDS vs TID) | Per-item choice required; merged list passes allergy, duplication and max-dose checks |
| S-11 | Combine Both would include a contraindicated item | Blocked until rejected/overridden with reason |
| S-12 | Record edited again while the doctor resolves | New conflict, no silent overwrite |
| S-13 | Allergy added at site A, allergy list edited at site B | Union; no allergy lost |
| S-14 | Allergy removal attempt | Requires explicit confirmation + reason; audited |
| S-15 | Update vs delete conflict | Conflict raised and resolvable |
| S-16 | Out-of-order delivery of dependent ops | Applied in `seq_no` order; dependents `BLOCKED` until resolved |
| S-17 | Emergency-bypass record syncs, then is linked to a patient | Linked via `LINK` op; audited; no duplicate patient |
| S-18 | Duplicate offline patient registration at two stations | Detected, merge-candidate review |
| S-19 | Token expires, offline several days | Ops retained; resume after re-auth |
| S-20 | Device clock wrong by days | Ordering by `server_seq`; skew flagged |
| S-21 | 14 days offline, 5k ops | Completes; resumable pagination |
| S-22 | Revoked device syncs | Rejected, alert, no data accepted |
| S-23 | Audio/scan upload interrupted repeatedly | Resumes from last chunk; hash verified; record acked independently |
| S-24 | Flaky network 30% loss for 10 minutes | Backoff works; no duplicates; eventual delivery |
| S-25 | Schema version mismatch | Safe rejection; ops preserved |
| S-26 | Mesh Peer exchange **[Extension]** | Same op ids dedupe across paths (peer and server) |

### 4.2 Sync performance
| Metric | Target |
|---|---|
| Eventual delivery under flaky network | >= 99.9%, 0 data loss |
| Duplicate-effect rate | 0 |
| Drain 100 queued ops on 3G | <= 60 s |
| Push p95 latency per batch (good network) | <= 1.5 s |
| Conflict detection | 100% of seeded conflicts; 0 silent merges of prescriptions |
| Convergence after reconnect (two devices) | <= 30 s good network |
| Audit upload completeness | 100% entries, chain verifies |

### 4.3 Data integrity
- Per-patient digest comparison (`/sync/verify`) after each test.
- Invariants: one `processed_operations` row per `op_id`; `server_seq` strictly increasing; contiguous `entity_versions`; no orphan chunks/attachments; tombstones propagated; allergy count never decreases through sync without an explicit removal op.
- Randomized chaos testing across 2-3 simulated devices (edits, offline periods, duplicates, reorders, crashes) must converge with no lost acknowledged write.
- Crypto: round-trip all entities; tampered ciphertext/AAD fails; wrong key yields nothing.
- Audit: modify/delete an entry and `/audit/verify` flags it; gaps detected; ingest idempotent.
- Backup/restore: restore PostgreSQL and re-sync without divergence.

### 4.4 Security tests
PIN brute force (lockout and hardware counter), password throttling, session and shift expiry, emergency-bypass scope (cannot read other charts, auto-expiry, review queue), token replay/expiry, revoked device, request tampering, SQL injection and oversized payloads on sync endpoints, PHI-in-logs scan (zero), dependency scan with no critical findings, share/print consent enforcement **[Extension]**.

---

## 5. Server Load
| Test | Target |
|---|---|
| 500 devices pushing 20 ops each | Error rate < 0.1%, p95 < 2 s |
| Pull with 100k changes | Stable pagination, flat memory |
| Idempotency table lookups | p95 < 20 ms; retention policy defined |

---

## 6. Reporting and Acceptance
**Deliverables:** test report with device specs, datasets, raw metrics (WER, CER, precision/recall, latency, RTF, memory), the S-01 to S-26 matrix with logs, integrity results, usability results, known limitations.

| Gate | Criteria |
|---|---|
| G1 Offline | 100% offline steps pass; no loss on crash |
| G2 Safety | Allergy conflict recall 100%; no unsafe save path; no auto-diagnosis |
| G3 Sync | S-01..S-25 pass; 0 duplicates; 0 silent overwrites |
| G4 Integrity | Invariants/digests pass; audit chain verifies |
| G5 AI | WER/CER/extraction/hallucination targets met or documented with mitigation |
| G6 Performance | Low-end Lite profile targets met or deviations documented |
| G7 Security | No critical findings; claims on the UI reviewed by legal |
| G8 Usability | SUS >= 75; task success rates met |

**Continuous evaluation:** unit, integration and chaos suites on every merge; nightly AI regression on golden sets with trend tracking; release blocked if allergy recall, hallucination rate or sync-integrity checks regress.
