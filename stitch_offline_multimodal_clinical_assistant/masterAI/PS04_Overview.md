# PS04 - Offline-First Multimodal Healthcare AI Assistant ("Swasthya Sync")

**Domain:** HealthTech / Generative AI / Edge AI
**Document:** Project Overview & UI Architecture
**Version:** 2.0 (aligned to the 7 designed mobile screens + `DESIGN.md` "Field Clinical Utility")

---

## 1. Executive Summary

### 1.1 Problem
Clinicians in rural and underserved regions (the design's example: a Health Outpost in Ganiyari, Bilaspur) work with unreliable connectivity. Patient information lives on handwritten prescription slips, paper reports, verbal consultations and fragmented records. Converting it into structured documentation by hand is slow and error-prone, history is not at hand during a consultation, and dangerous omissions (for example a known drug allergy) are easy to miss.

### 1.2 Solution
**Swasthya Sync** is an offline-first, mobile-first clinical documentation app. On a phone or tablet, with no network, a clinician can:
1. Sign in with a local vault password, quick PIN or biometric.
2. Find a patient in a locally cached directory and see a safety-first chart (allergy banner, vitals, history).
3. Capture a consultation by **voice**, **prescription/paper scan** and **typed notes**, with patient consent recorded first.
4. Let an on-device pipeline (Whisper.cpp, OCR, quantized LLM) draft a structured record: symptoms, suspected diagnosis (ICD-10), prescribed medicines, follow-up.
5. Have a deterministic **drug-allergy check** flag dangerous prescriptions (for example Amoxicillin for a penicillin-allergic patient) and propose a formulary alternative.
6. **Review, edit and approve** every AI suggestion; nothing is final without the clinician's verification.
7. Save locally, then **sync** to the hospital's central database when connectivity returns, with explicit **doctor-decided conflict resolution** when two sites changed the same record.

### 1.3 Design principles (from the UI and DESIGN.md)
| Principle | How the UI shows it |
|---|---|
| Offline is normal, not an error | Persistent pill "Works offline • Saved on device" on every screen |
| Safety first | Red allergy banner under the header on every patient-context screen |
| AI proposes, clinician decides | "Suggested from dictation / clinical presentation / recorded slip" badges, Edit / Accept per section, Doctor Verification checkbox |
| Explainable AI | "[View source audio]", "Why this suggestion", clinical reference chips ("From Visit 14 May 2025") |
| No silent data loss or overwrite | "Record Discrepancy - Needs Doctor Decision" screen |
| Field-usable | 48px+ touch targets, one-hand layouts, high contrast, English/Hindi |
| Plain language | "Saved on device", "Ready to send", "Sync pending" instead of technical terms |

### 1.4 Scope notes
- Core (PS04): voice capture, transcription, OCR, structured extraction, local storage, local RAG, sync engine with conflict resolution, encryption and audit.
- Designed but beyond core PS04 (treated as extensions in these docs): pharmacy stock display, POCT test ordering, Print/WhatsApp prescription, district referral generation, ABHA linkage, emergency bypass, "Mesh Peer" station-to-station sync. Each is marked **[Extension]** where it appears.

---

## 2. Platform & Architecture Summary
| Layer | Choice |
|---|---|
| Client | Mobile-first PWA (React + TypeScript, Service Workers, IndexedDB) or Flutter/native with SQLite; screens follow a 4-column mobile grid, 8-column on tablets |
| Edge AI | Whisper.cpp (speech, English/Hindi), local OCR, quantized LLM (structured extraction, summaries), rules engine (allergy, vitals) |
| Retrieval | Local search index + optional on-device embeddings (RAG) |
| Backend | FastAPI (or Node.js) authenticated sync APIs, PostgreSQL |
| Security | AES-256-GCM at rest, end-to-end encrypted payloads, device certificates, hash-chained audit logs |
| Sync | Operation log, UUID operation ids, version tracking, retry-safe requests, explicit conflict workflow |

Companion docs: `Edge_AI_Pipeline.md`, `Local_Storage_RAG.md`, `Sync_Engine_Mechanics.md`, `Security_Compliance.md`, `Evaluation_Metrics.md`.

---

## 3. Persistent UI Chrome (appears on most screens)
| Element | Behavior | Technical binding |
|---|---|---|
| Header: logo, "Swasthya Sync", screen subtitle (Clinical Review, Clinical Intake, Patient Directory & Records, Record Sync & Review), clinician name/avatar | Identity and context | Auth session; lock icon locks session |
| **Offline pill** "Works offline • Saved on device" (with cached patient count on directory) | Always-visible data-safety message; pulsing dot = live | `ConnectivityState` + local DB health |
| **Allergy alert banner** "ALLERGY ALERT: Severe Penicillin / Amoxicillin Anaphylaxis Risk (Cross-checked offline)" with risk tag (High Risk / Active Guard / Lethal Risk / Blocked in Sync) | Cannot be dismissed on patient-context screens | Computed from the `allergies` table, not from AI |
| Bottom navigation: Patients, Records, Reports, Settings | Records shows a badge when something needs review | Router; badge = open conflicts + failed ops |
| Safe-area padding, fixed header/nav | Works on notched phones | CSS env() |

---

## 4. Screen Inventory

### S1 - Login (Doctor Login / Quick PIN / Emergency Bypass)
| Component | Purpose |
|---|---|
| Header strip: "Encrypted SQLite DB", "Mesh Peer: Active" **[Extension]**, "FIPS 140-2" chip | Trust indicators (see section 7 for wording risks) |
| Station card: Station 04, Ganiyari Outpost Hub, "142 Patients Locally Cached • Ready" | Shows which local dataset is loaded |
| Tabs: **Doctor Login** / **Quick PIN** | Two auth paths |
| Terminal assignment (Tablet Node Alpha, SWITCH) | Chooses device role |
| Doctor ID / Medical Reg. No. + Local Vault Password (show/hide, "Forgot Key?") | Full unlock |
| "Trust this device for 12-hour offline shift" | Shift-length offline session |
| "SIGN IN TO CLINICAL WORKSTATION" (shows "INITIALIZING LOCAL DATABASE...") | Derives keys, opens encrypted DB |
| "Quick Biometric / 6-Digit PIN Quick Auth" + dial pad with fingerprint | Fast re-unlock during a shift |
| **Emergency Triage Bypass** card, "ENTER EMERGENCY BYPASS MODE" | Create-only intake without doctor credentials (break-glass) |
| Register New Medical Officer, Key Reset / SmartCard Issue | Onboarding and recovery |

### S2 - Staff Registration (3 steps: Credentials & Licensure, Biometrics, Node Provisioning)
Step 1 designed: Personal & Institutional Intake (legal name with locked "Dr." prefix, institutional email, field mobile), Medical Licensure (registration id with verified tick, "FHIR R4 Verified" tag, licensing council, specialty, degrees MBBS/MD/MS/DNB), Station Deployment (facility, locked role "Attending Field Physician"), Offline Station Security (passphrase, confirm, strength meter, 6-digit offline PIN), attestation checkbox, "Submit Registration for Verification" then "Node Certificate Issued". Steps 2 (biometrics) and 3 (node provisioning) are **not yet designed**. Registration needs connectivity (online-only).

### S3 - Patient Directory ("Patient Records")
| Component | Purpose |
|---|---|
| Offline pill with "248 Patients Cached", cloud-done icon | Local cache size |
| Allergy banner ("Active Guard") | Shown for the selected patient context |
| **New Patient** button | Offline patient registration |
| Search (name, ID, condition) + filter icon; chips All Patients (248), Visited Today (14), Follow-ups Due (8) | Local search and filters |
| **Today's Triage Queue** (3 in queue): Critical / Urgent / Routine cards with waiting time and status (Vitals logged, Lab pending, Chart ready); follow-up due strip | Prioritized work list |
| **Selected Patient Chart** summary: photo, name, ID, allergy chip, vitals (BP/pulse/temp/SpO2 with High flags), **Clinical Summary** with clinical reference chips, "Open Patient Chart", "Add Visit" | Quick look with AI/RAG-style summary |
| All Cached Patients list: per patient last visit, key vital, "Saved on device", View Patient Record, follow-up/med info | Browsing |
| Footer: "Encrypted Offline Clinical Directory • All 248 records saved locally" | Reassurance |

### S4 - Patient Medical Record
| Component | Purpose |
|---|---|
| Header with back, options, "Last updated" | Context |
| Identity card (initials/photo, name, ID, ward), call button | Patient identity |
| Current Vitals Summary with trends (BP 134/86 vs previous 130/82; Temp 101.4°F up from 99.1°F; Pulse; SpO2; Resp rate; Fasting blood sugar) | Vitals with deltas |
| Allergy alert card | Reinforces allergy |
| **Start New Consultation / Fast Intake** | Goes to S5 |
| **Order Test (POCT)** **[Extension]**, **Local RAG Insights** | Test ordering; historical insights |
| **Print / WhatsApp Rx (HI/EN)**, **Generate District Referral** **[Extension]** | Output documents |
| Consultation History with chips All / Doctor Notes / Medications / Lab Reports and cards: Today POCT results (Malaria RDT positive P.f., CBC sample collected "Pending Backhaul Sync", RBS 110 mg/dL), Today 09:30 outreach clinic "Saved on device - Sync pending", 14 May 2025 "Synced to Hospital EHR", 02 Feb 2025 adverse drug event | Timeline with sync badges |

### S5 - Clinical Intake (capture)
| Component | Purpose |
|---|---|
| Patient identity banner with Switch Patient | Context |
| **Consent Protocol** toggle ("Patient consent verified for offline audio transcription") | Gate for recording |
| **Record Doctor Voice Note**: language selector (English / Hindi), timer, waveform, "Edge Transcript Stream - Chunk 3 - Local WASM", transcript text (Hindi shown in Devanagari), "Why this suggestion", Pause, Stop & Save Note | Voice capture and live local transcription |
| **Scan Prescription or Paper Slip**: thumbnail, file name, "Ready", extracted medication line, **CRITICAL DRUG-ALLERGY CONFLICT** card with "Choose Safe Formulary Alternative (e.g. Azithromycin)", "Take Photo or Scan Document" | OCR and safety check |
| **Doctor's Manual Notes & Symptoms** textarea | Typed notes (always available) |
| Status line "Drafting record from audio and notes... Ready for doctor review." + **Proceed to Review** | Triggers extraction and moves to S6 |

### S6 - Clinical Review (structured record)
| Section | Content | Actions |
|---|---|---|
| Patient card | Photo/retake, name, age/sex, ABHA Linked tag, ID, visit type, date/time, Edit Demographics, ABHA/Health ID, spouse/guardian, phone, village | Edit demographics, retake photo |
| Patient Vitals (recorded at intake) | BP 128/82, HR 88, Temp 101.4°F (High - Fever, trend), SpO2 98% | Measured values |
| 1. Symptoms & Complaints | Suggested from dictation; source quote; [View source audio]; "Edited by Dr." | Edit / Accept |
| 2. Suspected Diagnosis | ICD-10 R50.9 Fever, R51.9 Headache; source quote | Change / Accept |
| 3. Prescribed Medicines | Drug-Allergy Conflict (Amoxicillin 500mg contraindicated) with Reject Amoxicillin / Adopt Azithromycin; Paracetamol 650mg and ORS with stock badge "In stock at this station (1,420 units)" **[Extension]** | Edit / Remove / Accept per item |
| 4. Follow-up & Warning Signs | Return in 48 h if fever above 102°F or persistent vomiting; emergency if neck rigidity or confusion | Editable |
| Doctor Verification | Checkbox "I have reviewed and confirmed this medical record", **Save & Approve Record**, "Changes are recorded to local clinic database" | Final sign-off |

### S7 - Record Sync & Review (conflict)
| Component | Purpose |
|---|---|
| Header with "Sync Now", "1 Record needs review", allergy banner tag "Blocked in Sync" | Sync status |
| Patient context card | Who the conflict is about |
| **Record Discrepancy - Needs Doctor Decision** (Visit #ENC-9921): explanation, Penicillin auto-rejected chip, stock chip | Conflict summary |
| Side-by-side cards: **This Clinic Station** (09:30: Paracetamol 650mg QDS + Azithromycin 500mg) vs **Hospital Center** (08:45: Paracetamol 650mg TID + Cetirizine 10mg) | Version A vs Version B |
| Buttons: **Keep This Clinic's Rx**, **Keep Hospital Center Rx**, **Combine Both Medicines** | Resolution choices |
| "Confirming as: Dr. ... (Medical License ...)" + **Save & Confirm Patient Record** | Signed resolution |
| **Records Waiting to Sync** list: Visit & Triage Notes (Saved on device), Rapid Malaria Test Result (Ready to send), Vital Signs Check (Saved on device) | Outbox view |

### Screens referenced but **not yet designed**
Reports tab; Settings tab (language, model management, storage, sync inspector, privacy); New Patient form; Edit Demographics; photo capture; Order Test (POCT) flow; Local RAG Insights view; Rx print/WhatsApp preview; District Referral preview; View Full Consultation; triage queue detail; registration steps 2-3; key reset/SmartCard flow; emergency bypass intake form; lock screen; audit viewer; failed-sync detail. These should be designed before build or implemented from the design system tokens.

---

## 5. Primary User Journeys
1. **Shift start:** Login > local vault unlock (or PIN/biometric) > directory loads from local DB.
2. **Consultation:** Directory > Patient Record (allergy banner, vitals, history) > Start New Consultation > consent toggle > record voice / scan slip / type notes > Proceed to Review > edit/accept sections > resolve allergy conflict > Doctor Verification > Save & Approve > record appears in history as "Saved on device - Sync pending".
3. **Reconnect:** pill changes, outbox drains, items show "Synced to Hospital EHR"; if the hospital changed the same visit, Records tab shows a badge and S7 asks the doctor to decide.
4. **Emergency:** Login > Emergency Bypass > anonymous create-only intake > later linked to a patient by an authenticated clinician.

---

## 6. Screen State Dictionary

### 6.1 Connectivity (header pill)
| State | Label | Behavior |
|---|---|---|
| Offline | "Works offline • Saved on device" | Everything local works; sync paused |
| Online, syncing | "Syncing n records" (spinner) | UI usable; outbox drains |
| Online, synced | "Synced" + last sync time | Normal |
| Flaky | "Unstable connection" | Small batches, backoff |
| Sync error | "Sync problem - tap to retry" | Ops preserved, reason shown |
| Attention | "n record needs review" | Open conflicts |

DESIGN.md badge mapping: Offline (grey), Local-Only (amber), Synced (green), Conflict (red), Verifying (teal).

### 6.2 Record sync badges (UI wording to technical state)
| UI label | Technical state |
|---|---|
| Saved on device | `LOCAL_ONLY` / committed locally |
| Saved on device • Sync pending | `PENDING_SYNC` |
| Ready to send | `PENDING_SYNC`, eligible now |
| Pending Backhaul Sync | Sample/attachment waiting for upload |
| Synced to Hospital EHR | `SYNCED` (acked) |
| Action Required / Needs Doctor Decision | `CONFLICT` |
| Blocked in Sync | `BLOCKED` (dependent ops held until conflict resolved) |

### 6.3 AI field states
`Suggested` (AI badge) > `Edited by Dr. X` (human changed) > `Accepted` (per-section confirm) > `Verified` (Doctor Verification). Unverified drafts never count as clinical history or RAG source.

### 6.4 Other states
| Area | States |
|---|---|
| Recording | idle, recording, paused, saved locally |
| Transcription | queued, chunk n running, complete, failed (manual notes still available) |
| Scan | capturing, processing, ready, low confidence |
| Allergy check | clear, conflict (blocking until Reject/Adopt/Override), alternative adopted |
| Session | locked, unlocked, shift expiring, emergency bypass |
| Consent | not recorded (recording disabled), recorded, withdrawn |

---

## 7. Design Review Findings (fix before development/demo)

### 7.1 Safety and security wording
| # | Finding | Recommendation |
|---|---|---|
| 1 | Login claims "HIPAA Compliant • FIPS-140-2 Salted Vault" and a "FIPS 140-2" chip | Do not claim certification unless validated. Use "AES-256 encrypted vault". HIPAA is a US law; for India reference DPDP Act 2023 and ABDM requirements, and confirm with legal counsel |
| 2 | "High (384-bit Entropic)" passphrase meter | Misleading; show Weak/Fair/Strong based on a real estimator (e.g. zxcvbn) |
| 3 | 6-digit PIN as offline unlock | Acceptable only with attempt limits and a hardware-bound key; never the only derivation of the data key (see `Security_Compliance.md`) |
| 4 | Emergency Bypass without credentials | Needs break-glass controls: create-only, reason, auto-expire, loud audit, post-hoc review |
| 5 | "Combine Both Medicines" labelled "Recommended clinical course" | The system must not recommend clinically; show rule-check results instead (e.g. "No allergy or duplication issues found") |
| 6 | "Print / WhatsApp Rx" | Sends PHI outside the E2EE boundary; needs patient consent, minimal content, audit entry |
| 7 | "Mesh Peer: Active" | Peer sync is out of PS04 core; hide or mark experimental |

### 7.2 Mock-data inconsistencies
| Item | Inconsistency |
|---|---|
| Clinician name | Dr. Sarah Jenkins, Dr. E. Jenkins, Dr. Evelyn Reed on different screens |
| Vitals | Intake 128/82 BP and HR 88 on S6 vs 134/86 and pulse 78 on S3/S4/S7; SpO2 97% vs 98% |
| Cached patients | 142 on login vs 248 on directory |
| Clinical story | Hindi transcript describes cough and chest pain; review quotes headache and fever 101.5F; sync screen says bronchitis; S4 shows malaria RDT positive while the diagnosis remains "Acute Viral Pyrexia" |
| Diagnosis labelling | R51.9 is an ICD-10-CM code; WHO ICD-10 (used in India) lists R51. Confirm the code set |
| Stock | 1,420 units shown for three different drugs |
| Visit identifiers | #ENC-6120 (allergy event) vs 02 Feb 2025 history card; #ENC-9921 on conflict |

The positive malaria test next to an unchanged "viral pyrexia" diagnosis is a good demonstration of **clinician-review value**: the system may surface the new result as a *prompt* ("New positive result - review diagnosis") but must never change the diagnosis itself.

### 7.3 UX gaps
Medication conflict resolution is whole-prescription only (needs per-item resolution when the same drug differs); no way to override an allergy alert with documented reason; no offline "storage almost full" or "models missing" indicator designed; no visible audit/access history; Hindi UI strings not shown outside the transcript and Rx button.

---

## 8. Safety Disclaimer
Swasthya Sync is a documentation aid, not a diagnostic device. All AI-generated content must be reviewed and verified by a licensed clinician. The review screen should carry a short persistent notice to this effect.
