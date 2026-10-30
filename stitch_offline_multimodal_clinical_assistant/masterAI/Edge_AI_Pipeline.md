# Edge AI Pipeline - On-Device AI Functional Specification (Swasthya Sync)

Scope: everything that runs on the device, offline, between the **Clinical Intake** screen (S5) and the **Clinical Review** screen (S6), plus the AI-assisted elements on the patient chart (S3/S4). Screen ids refer to `PS04_Overview.md`.

---

## 1. Where AI Appears in the UI
| UI element | AI component |
|---|---|
| S5 "Record Doctor Voice Note", "Edge Transcript Stream - Chunk 3 - Local WASM" | Whisper.cpp (WASM/native) |
| S5 "Scan Prescription or Paper Slip", "Extracted medication list and handwritten notes" | OCR + medication parser |
| S5 "CRITICAL DRUG-ALLERGY CONFLICT", "Choose Safe Formulary Alternative" | Deterministic drug-allergy rules engine (not an LLM) |
| S5 "Drafting record from audio and notes..." + "Proceed to Review" | Quantized LLM structured extraction |
| S6 badges "Suggested from dictation / clinical presentation / recorded slip" | Provenance of each extracted section |
| S6 "[View source audio]", quoted dictation | Segment-to-audio linking |
| S5 "Why this suggestion" | Rationale from rules/RAG for each suggestion |
| S3 "Clinical Summary" + "Clinical References: From Visit 14 May 2025", S4 "Local RAG Insights" | Local RAG + LLM summary with citations |
| S6 "In stock at this station (n units)" **[Extension]** | Local formulary/stock lookup (no AI) |

---

## 2. Pipeline Overview
```
Consent gate (S5 toggle)
   |
Voice  -> chunker -> Whisper.cpp -> transcript segments -----------\
Scan   -> image pre-process -> OCR -> text blocks + med parser ----+--> Text Feed (source-tagged)
Typed notes (textarea) ---------------------------------------------/        |
                                                                              v
                      Patient context (allergies, active meds, recent history via RAG)
                                                                              |
                                  Normalizer -> LLM extraction (JSON schema) -> Validators/rules -> S6 draft
```
Everything heavy runs in Web Workers (PWA) or background isolates/threads (mobile) so the waveform, timer and buttons stay responsive. All steps are driven by a persistent `ai_jobs` queue so the work survives app kills.

---

## 3. S5 Interactions, Step by Step

### 3.1 Consent gate
- The **Consent Protocol** toggle must be ON before the record button is enabled. Turning it ON writes a consent record (patient id, scope "audio transcription", clinician, timestamp) and an audit entry. Turning it OFF mid-recording stops capture and prompts to discard or keep.

### 3.2 Record Doctor Voice Note
| Step | Behavior |
|---|---|
| Start | Request microphone permission once; verify the Whisper model is installed and its checksum is valid; if not, show a banner and keep typed notes available |
| Language | English or Hindi selector sets the Whisper language; optional auto-detect; the selector can change per recording |
| Capture | 16 kHz mono PCM via AudioWorklet; timer (e.g. 01:14) and waveform animation driven by real amplitude |
| Chunking | ~30 s chunks with ~1 s overlap, cut on silence (energy VAD); chunk counter feeds the label "Chunk 3" |
| Persist | Each chunk encrypted and stored immediately; a crash loses at most the current chunk |
| Transcribe | One `ai_jobs` row per chunk; segments stream into the "Edge Transcript Stream" box as they complete (Devanagari text displayed as produced) |
| Pause | Suspends capture, keeps session open; Resume continues in the same note |
| Stop & Save Note | Finalizes the audio file; button changes to "Saved Locally"; remaining chunks continue transcribing in background |
| Retention | Raw audio kept until the record is verified and synced, then purged per policy (see Security doc); audio is what "[View source audio]" plays |

### 3.3 Scan Prescription or Paper Slip
| Step | Behavior |
|---|---|
| Capture | "Take Photo or Scan Document" opens the camera or file picker |
| Pre-process | Auto-crop, deskew, grayscale, adaptive threshold, denoise, downscale to about 2000 px; keep original and processed copies |
| OCR | Local OCR (Tesseract WASM or platform OCR) with languages English and Hindi; returns words, boxes, confidence |
| Medication parser | Rule-based parser extracts drug name, strength, frequency ("TDS"), duration, route; fuzzy-matches names to the local formulary |
| Card | The thumbnail card shows file name, state (Processing / Ready / Low confidence) and the extracted line ("Amoxicillin 500mg TDS • Paracetamol 650mg") |
| Handwriting | Handwritten text is low-reliability: show low-confidence words underlined and always require review |

### 3.4 Doctor's Manual Notes & Symptoms
Typed text is a first-class source with the highest trust: it is never overwritten by AI. It is shown to the model as "clinician-typed" and wins over conflicting dictation unless the clinician chooses otherwise.

### 3.5 Proceed to Review
1. Gather the Text Feed (transcripts, OCR text, typed notes), each segment tagged `{source, time/page, confidence, language}`.
2. Create the extraction job; status line shows "Drafting record from audio and notes...".
3. On completion: "Ready for doctor review" and navigation to S6 with a **draft** (`status=DRAFT`, `ai_generated=true`).
4. If AI fails or models are missing, S6 opens with empty fields plus the typed notes so the doctor can still document manually.

---

## 4. Drug-Allergy Safety Engine (deterministic, always on)
Runs on every medication from any source (OCR, dictation, manual entry, imported history) and on any later edit, including conflict resolution (S7).

| Aspect | Specification |
|---|---|
| Inputs | Patient allergy list (substance, class, severity, reaction, source encounter), proposed medication list |
| Knowledge | Local drug dictionary mapping brand/generic names to ingredient and class (for example amoxicillin is a penicillin; penicillins and other beta-lactams flagged per the recorded allergy scope) |
| Output levels | **Contraindicated** (allergen class match), **Caution** (possible cross-reactivity), **None** |
| UI | Red conflict card in S5/S6 "Drug-Allergy Conflict Detected - Contraindicated", with **Reject** and **Adopt alternative**; banner stays visible |
| Alternatives | From the local formulary: same indication class, not allergen-related, shown with local stock if available; presented as options, never auto-applied |
| Override | Allowed only with explicit clinician action and mandatory reason; logged as a high-priority audit event (design currently lacks this control) |
| Why deterministic | The LLM can misread or omit; allergy checks must be reproducible and testable (100% recall target in `Evaluation_Metrics.md`) |

Also deterministic: duplicate therapy check, maximum daily dose check (for example total paracetamol per day against a configurable limit), and vitals range flags (High - Fever, Stage 1, SpO2 low).

---

## 5. LLM Orchestration for S6 Fields

### 5.1 Model and prompt
Quantized instruction model (about 1-3B parameters, 4-bit) via WebLLM/wllama or llama.cpp. Prompt = system rules (extract only what is stated, null if unknown, JSON only, no new diagnoses unless stated or in the allowed suggestion list) + JSON schema + patient context (allergies, active medications, concise RAG snippets) + Text Feed with segment ids.

### 5.2 Mapping to S6
| S6 section | JSON path | Notes |
|---|---|---|
| 1. Symptoms & Complaints | `chief_complaint`, `hpi`, `symptoms[]` | Headline line + narrative paragraph (as in "Acute febrile illness with severe headache (3 days duration)") |
| Patient vitals | `vitals{bp,hr,temp,spo2}` | **Measured intake values take precedence**; vitals mentioned in dictation are only cross-checked, and a mismatch raises a small flag (for example 101.5F said vs 101.4F measured) |
| 2. Suspected Diagnosis | `diagnoses[{text, icd10, rationale, source_refs}]` | Symptom codes (R-codes) are the safe default; specific disease diagnoses only if the clinician stated them. Always labelled "Suggested", accepted with **Accept** or changed with **Change** |
| 3. Prescribed Medicines | `medications[{name, strength, route, frequency, duration, instructions, source}]` | From slip + dictation + typed notes; runs through the allergy engine; stock badge looked up locally |
| 4. Follow-up & Warning Signs | `followup{when, conditions}`, `red_flags[]` | Example: return in 48 h if fever above 102F; emergency signs listed |
| Patient card | `demographics` | Not AI-extracted; from the patient record |
| Provenance (all) | `source_refs[]`, `confidence`, `ai_generated`, `edited_by` | Drives the "Suggested from ..." badge and "Edited by Dr. X" line |

### 5.3 Output safeguards
1. Constrained/JSON-schema decoding where supported; validate against the schema.
2. One repair pass on invalid output; then rule-based fallback for vitals, medications and dates; then empty form with typed notes.
3. Validators: unit/range checks, formulary fuzzy match, allergy engine, duplicate therapy, dose limits.
4. Confidence below threshold: field highlighted and cannot be bulk-accepted.
5. "Why this suggestion" text is generated from structured evidence (matched symptoms, rule ids, cited history) rather than free-form LLM prose.
6. Confirm the ICD-10 code set with the target program (WHO ICD-10 lists R51 for headache; R51.9 belongs to ICD-10-CM).

### 5.4 Rendering and review behavior
- Each section card shows the source chip: microphone + quoted dictation + **[View source audio]** (jumps to the audio offset), scan icon for slip-derived items.
- **Edit** opens inline editing and switches the footer to "Edited by Dr. X"; **Accept** records per-section acceptance; **Remove** drops a medicine.
- Re-extraction never overwrites edited fields; it proposes a diff instead.
- **Save & Approve Record** is enabled only when the Doctor Verification checkbox is ticked and no unresolved Contraindicated alert remains.
- Positive POCT results (for example malaria RDT) can raise a **review prompt** next to the diagnosis; the system never changes the diagnosis by itself.

---

## 6. Local RAG on the Chart (S3 "Clinical Summary", S4 "Local RAG Insights")
Detailed in `Local_Storage_RAG.md`. AI-relevant points:
- Summary text is generated by the local LLM from retrieved verified history only, with each statement carrying a citation chip such as "From Visit 14 May 2025".
- Active allergies and current medications are always included regardless of search score.
- If nothing relevant is found, the panel says so.
- Summary generation runs in the background and is cached by patient and latest record version.

---

## 7. Job Queue, Models and Resources
| Concern | Design |
|---|---|
| Job states | `queued > running > needs_review > done` or `failed`; resumable after crash |
| Concurrency | One heavy model at a time; transcription has priority while recording, extraction waits |
| Model profiles | **Lite** (tiny/base Whisper, ~1B LLM) for 2-3 GB RAM devices; **Standard** for 6 GB+; auto-selected and overridable in Settings |
| Model management | Download once when online (Wi-Fi only option), SHA-256 verified, version pinned, storage usage shown in Settings |
| Battery/thermal | Pause background AI under low battery; visible indicator |
| Privacy | No audio, image or text leaves the device for inference |

---

## 8. Failure Modes
| Failure | UI behavior |
|---|---|
| Mic denied | Explain; typed notes and scan remain |
| Model missing/corrupt | Banner in S5; manual path works; "Download when online" |
| Out of memory | Restart worker, drop to Lite profile, retry once |
| Poor audio/garbled transcript | Low-confidence markers; allow re-record or edit transcript |
| OCR low confidence | Prompt retake/enhance or type |
| LLM invalid output | Repair pass, fallback extractor, or empty draft |
| Allergy engine data missing | Show "Allergy list unavailable - verify manually" and block Save & Approve |
| App killed mid-job | Jobs resume on next launch |
