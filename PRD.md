# Product Requirements Document: Offline-First Multimodal Clinical Documentation Assistant

**Working name:** OfflineScribe (placeholder, rename freely)
**Problem statement:** PS04, HealthTech / Generative AI / Edge AI
**Document status:** Draft v0.1, 30 Oct 2026
**Basis:** research report "PS04 research: offline-first clinical documentation assistant"

---

## 1. Summary

OfflineScribe lets healthcare workers in low-connectivity settings capture voice notes and scan paper documents, turns them into structured case files with on-device AI, and keeps a searchable patient history on the device. When connectivity returns, a sync engine uploads encrypted changes to a central PostgreSQL database without duplicating, losing or silently overwriting anything. Every AI-generated field is a draft until a clinician approves it.

The main engineering deliverable is the sync engine. The AI pipeline is important but is built from components that already run on phones offline.

## 2. Problem

Rural and underserved clinics work with unreliable internet. Patient information is scattered across handwritten notes, paper reports, spoken consultations and fragmented digital records. Converting that into structured documentation by hand is slow, error-prone and leaves records incomplete, and prior history is hard to find during a consultation.

## 3. Goals and non-goals

### Goals

| ID | Goal |
| --- | --- |
| G1 | Full capture, extraction, review and search workflow works with no network at all |
| G2 | Voice notes and document images become structured, clinician-reviewable case files |
| G3 | Patient history is searchable locally and can produce a cited summary |
| G4 | Sync is retry-safe, duplicate-free, detects concurrent edits and never silently discards a change |
| G5 | Patient data is encrypted at rest on the device and in transit; every action is audit-logged |
| G6 | Runs acceptably on a low-end Android phone |

### Non-goals (v1)

- Diagnosis, treatment recommendations or any autonomous clinical decision.
- Real-time multi-user collaborative editing of the same note.
- Full ABDM integration (ABHA login, consent manager). The data model is FHIR-shaped so export is possible later.
- Support for every Indian language. Hindi and English are the target; other languages are stretch goals.
- Replacing a hospital EHR.

## 4. Users

| Persona | Context | Needs |
| --- | --- | --- |
| Frontline health worker (ASHA, ANM, nurse) | Village visits, shared low-end phone, no signal | Fast capture, minimal typing, simple review screen |
| Clinician at a primary health centre | Intermittent connectivity, paper records inherited | Accurate drafts, quick history lookup, easy corrections |
| Facility admin | Manages devices and staff | Sync status, conflict queue, device revocation |
| Auditor / reviewer (secondary) | Checks record integrity | Audit log, verifiable sync history |

## 5. User stories

1. As a health worker, I record a spoken consultation offline and get a draft case file to review.
2. As a clinician, I photograph a lab report or prescription and get extracted fields I can correct against the image.
3. As a clinician, I ask for a patient's recent history and get a short summary that links to the visits it came from.
4. As a health worker, I keep working when the signal drops mid-sync, and nothing is lost or doubled.
5. As a clinician, when two devices changed the same field, I see both versions side by side and choose.
6. As an admin, I revoke a lost device so it can no longer sync.

## 6. Functional requirements

### 6.1 Capture

| ID | Requirement | Priority |
| --- | --- | --- |
| F1 | Record audio with start/stop, show elapsed time, store audio encrypted on the device | Must |
| F2 | Capture document images with the camera or file picker, with crop and deskew | Must |
| F3 | Typed entry for any case-file field | Must |
| F4 | Patient lookup and creation by local ID, name and age, with duplicate warning | Must |
| F5 | Language selector for speech (Hindi, English at minimum) | Must |

### 6.2 On-device AI pipeline

| ID | Requirement | Priority |
| --- | --- | --- |
| A1 | Local speech-to-text using whisper.cpp or an equivalent, with voice-activity detection before decoding | Must |
| A2 | Deterministic decoding and a filter for known hallucination phrases | Must |
| A3 | Local OCR for printed and handwritten documents; classify input as printed or handwritten | Must |
| A4 | Drug-name correction against a bundled formulary with fuzzy matching | Should |
| A5 | Quantized LLM converts transcript or OCR text to a fixed JSON schema (complaint, history, vitals, diagnosis, medications with dose and unit, follow-up) using constrained decoding | Must |
| A6 | Every extracted field stores its source snippet and a confidence flag; unstated fields are null, never guessed | Must |
| A7 | A verification pass flags medications and numbers in the JSON that do not appear in the source text | Should |
| A8 | Translation between supported languages where a model is available, clearly labelled as machine-translated | Could |

### 6.3 Review and records

| ID | Requirement | Priority |
| --- | --- | --- |
| R1 | All AI output is marked "draft" until a clinician approves; approval is recorded with user and time | Must |
| R2 | Review screen shows the source (audio playback with transcript, or the scan) beside each field | Must |
| R3 | Low-confidence words and fields are visually highlighted | Should |
| R4 | Drug name, dose and unit require explicit confirmation before approval | Must |
| R5 | Edits create versioned operations; history of each field is viewable | Must |

### 6.4 Retrieval

| ID | Requirement | Priority |
| --- | --- | --- |
| S1 | Index approved notes and documents on the device (full-text plus vector search in SQLite) | Must |
| S2 | Retrieval is always scoped to a single patient before ranking | Must |
| S3 | History summary cites encounter dates and links to source visits | Must |
| S4 | Embedding model supports Hindi if Hindi notes are in scope | Should |

### 6.5 Sync engine (primary deliverable)

| ID | Requirement | Priority |
| --- | --- | --- |
| Y1 | Every change is an immutable operation in a local log with a client-generated unique ID, device ID, patient ID, field path, base version, new value and local timestamp | Must |
| Y2 | Sync API accepts each operation ID idempotently; repeats return the stored result; reuse of an ID with a different payload is rejected | Must |
| Y3 | Server keeps a permanent dedupe table of operation IDs (not time-limited, since devices may be offline for weeks) | Must |
| Y4 | Version tracking per record, with a per-device version vector or equivalent, to detect concurrent edits | Must |
| Y5 | Conflict rules: base version matches, apply; different fields, auto-merge and log; same field or delete versus edit, store a conflict record and apply neither | Must |
| Y6 | Conflict resolution screen: side-by-side versions, choose one, edit a merged value, or keep both; the decision is itself a logged operation | Must |
| Y7 | Retry transient failures with backoff; surface validation and permission rejections to the user instead of retrying forever | Must |
| Y8 | Sync resumes after app kill, network loss mid-request, or lost response without duplicates | Must |
| Y9 | Hash-chained audit log; per-patient checksum compared between device and server after sync | Must |
| Y10 | Sync status indicator: pending count, last success, conflicts waiting | Must |
| Y11 | Device registration and revocation | Should |
| Y12 | Server-side append-only operations (for example CRDT-style) for notes and attachments that only grow | Could |

### 6.6 Security and privacy

| ID | Requirement | Priority |
| --- | --- | --- |
| P1 | Sensitive fields, transcripts, audio and images encrypted at rest with AES-GCM and a unique IV per record | Must |
| P2 | Key derived from clinician PIN or passphrase plus a device-bound key; keys cleared on logout and after idle timeout | Must |
| P3 | TLS plus authenticated tokens for all sync traffic | Must |
| P4 | Document which fields the server can read; clear docs on what "end-to-end encrypted" does and does not cover | Must |
| P5 | Role-based access (health worker, clinician, admin) | Should |
| P6 | Audit log of view, create, edit, approve and resolve actions, synced with other data | Must |
| P7 | Recovery path for lost keys for approved records | Should |
| P8 | Data model aligned to FHIR R4 resources (Patient, Encounter, Observation, MedicationRequest, DocumentReference) with SNOMED CT and LOINC codes where available | Should |

## 7. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Offline | Every Must workflow in sections 6.1 to 6.4 works in airplane mode |
| Performance | Targets to be fixed after device benchmarking; measure real-time factor of speech, LLM tokens per second, RAM, battery and temperature on a low-end Android phone |
| Storage | Models bundled or downloaded once; app reports storage used |
| Reliability | No data loss on crash, kill or power loss; writes are atomic |
| Usability | Core flow completable by a trained health worker with minimal typing; large touch targets; local-language UI strings |
| Safety | AI output never overwrites approved data without a new approval |
| Observability | Local diagnostic log (no patient content) that can be exported on request |

## 8. System design summary

```
Phone (offline)                                     Server (online)
-------------------------------------------         ------------------------
Voice / Scan / Typed
   |
Whisper.cpp + VAD      OCR + drug check
   \                    /
    On-device LLM -> draft case file (JSON + sources)
            |
     Clinician review & approval
            |
 Encrypted SQLite (records, FTS, vectors) --> Operation log ==sync==> Sync API (FastAPI)
            ^                                                      -> Dedupe table
            |__ history retrieval (RAG)                            -> Version check / conflicts
                                                                   -> PostgreSQL + audit log
```

### Proposed stack

| Layer | Choice | Note |
| --- | --- | --- |
| Client | Cross-platform or native Android app with SQLite as primary build; PWA for review and light capture | PWA storage can be cleared by the browser, and heavy models in WASM are unproven here |
| Speech | whisper.cpp, small quantized model, fine-tuned Hindi model | Convert and benchmark candidates |
| OCR | PaddleOCR / PP-OCRv5 for print; test GLM-OCR and others for handwriting | Re-benchmark on own samples |
| LLM | 2 to 4B int4 model through llama.cpp or LiteRT-LM | Pick on faithfulness, not only capability |
| Retrieval | SQLite FTS plus sqlite-vec, multilingual embeddings | Patient-scoped |
| Backend | FastAPI | Node.js is an acceptable alternative |
| Database | PostgreSQL | Operations, dedupe table, records, audit log |

### Operation record (logical schema)

| Field | Purpose |
| --- | --- |
| `op_id` | Client-generated UUID or ULID; idempotency key |
| `device_id` | Origin device |
| `patient_id` | Pseudonymous patient key (clear, for routing) |
| `entity`, `field_path` | What changed |
| `base_version` | Version the edit was made from |
| `value_enc` | Encrypted new value |
| `client_ts` | Local timestamp (informational, not used for ordering) |
| `prev_hash`, `hash` | Audit chain |
| `status` | pending, sent, applied, conflicted, rejected |

## 9. Success metrics and evaluation

Targets below are proposals to be confirmed after the first device benchmarks.

| Criterion | Metric | Test |
| --- | --- | --- |
| Offline usability | Whole flow works with zero network calls; task time | Airplane-mode scripted run |
| Extraction accuracy | Field-level precision, recall, F1; exact match on drug, dose, unit reported separately | Scripted visits and scanned documents with known answers |
| Speech and OCR | WER (clean and noisy, Hindi and English), CER, hallucinated phrases per hour | Per-condition report, not one average |
| Sync reliability | Duplicate applies and lost operations | Fault injection: drop response after commit, duplicate and reorder deliveries, kill app mid-sync; target 0 and 0 over thousands of random runs |
| Conflict handling | Silent overwrites | Same field on two devices, different fields, delete versus edit, three devices; target 0 silent overwrites |
| Data integrity | Device and server checksum match | After every sync, plus tamper test on the audit chain |
| Resource use | Real-time factor, tokens per second, RAM, battery, temperature | Simulated 8-hour clinic day on a low-end Android phone |

Test data: synthetic transcripts and synthetic or de-identified documents only.

## 10. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Whisper invents text | Wrong clinical content | VAD, deterministic decoding, junk filter, keep audio, mandatory approval |
| Handwriting OCR unreliable | Wrong drugs or doses | Draft only, formulary correction, image always attached, confirm dose fields |
| Weak Indic speech accuracy | Poor drafts in Hindi | Fine-tuned small model; scope languages honestly |
| Phone heat and memory | Slow or crashing app | Small int4 model, short bursts, test on low-end hardware |
| Confusing conflict screen | Clinicians skip or mis-resolve | Two-column compare, one-tap choices, auto-merge disjoint fields only |
| Lost encryption key | Unrecoverable data | Server-side recovery for approved records, documented key policy |
| Regulatory change | Rework | Keep a compliance note; confirm DPDP and ABDM status on official sources |

## 11. Compliance notes

- India's Digital Personal Data Protection Act 2023 applies; health-specific rules were not yet notified as of early 2026 according to the sources reviewed. Confirm current status before any deployment.
- ABDM uses HL7 FHIR R4, consent-based sharing and ABHA IDs. v1 aligns the data model with FHIR but does not integrate.
- This is a documentation aid, not a medical device claim; it must not be used for diagnosis.

## 12. Milestones (phases, not dates)

1. **Sync core:** operation log, idempotent API, version tracking, fault-injection harness.
2. **Local store and review UI:** encrypted FHIR-shaped schema, case-file editor, approval, audit log.
3. **Voice path:** VAD, whisper.cpp, transcript to structured JSON with sources.
4. **Document path:** capture, preprocessing, OCR, formulary correction, extraction.
5. **Retrieval:** FTS plus vector index, patient-scoped summaries.
6. **Conflict resolution UI** and live demo script.
7. **Measurement:** run the evaluation table, publish honest results including failures.

## 13. Open questions

1. Primary target device and minimum RAM?
2. Which languages must be demonstrated?
3. Is a PWA required by the problem statement's evaluators, or is a native-first build acceptable?
4. Who owns the formulary list and which one is used?
5. Does the server need to read clinical content (for central search), or can it stay ciphertext-only?
6. Any hosting or data-residency constraint for the central database?
