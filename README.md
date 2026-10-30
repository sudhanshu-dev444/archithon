# OfflineScribe

An offline-first, multimodal AI assistant that helps healthcare workers in low-connectivity areas capture voice notes and scan medical documents, turn them into structured case files on the device, search patient history locally, and sync safely to a central database when the network returns.

> **Status:** design and planning stage (PS04, HealthTech / Generative AI / Edge AI). The commands and repository layout below are a proposed scaffold, not a released build. See [PRD.md](./PRD.md) for full requirements.

> **Safety:** OfflineScribe is a documentation aid. It does not diagnose or recommend treatment. All AI output is a draft until a clinician reviews and approves it.

## Why

Rural clinics often have unreliable internet, and patient information lives in handwritten notes, paper reports and spoken consultations. Typing it all into records is slow and error-prone. OfflineScribe moves that work onto the phone, works with no signal, and treats data integrity as the first requirement.

## Features

- **Voice capture** with local speech-to-text (whisper.cpp), voice-activity detection and hallucination filtering.
- **Document scanning** with local OCR, printed vs handwritten routing and drug-name correction.
- **Structured case files:** a quantized on-device LLM converts text into a fixed JSON schema, with every field linked to its source snippet. Missing information stays empty, never guessed.
- **Clinician review:** side-by-side source and fields, low-confidence highlighting, mandatory confirmation of drug, dose and unit.
- **Local search and RAG:** SQLite full-text plus vector search, always scoped to one patient, with cited history summaries.
- **Reliable sync:** operation log, idempotency keys, version tracking, explicit conflict detection and a human-in-the-loop resolution screen.
- **Privacy:** encrypted storage on the device, TLS in transit, audit log of every action.

## Architecture

```
Phone (works offline)                               Server (when online)
-------------------------------------------         ------------------------
Voice note / Document scan / Typed entry
      |
Whisper.cpp + VAD        OCR + drug-name check
      \                   /
       On-device LLM -> draft case file (JSON + sources)
                 |
        Clinician review and approval
                 |
 Encrypted SQLite (records, FTS, vectors) -> Operation log ==sync==> Sync API (FastAPI)
        ^                                                          -> Dedupe table
        |__ history retrieval (RAG)                                -> Version check / conflicts
                                                                   -> PostgreSQL + audit log
```

## Tech stack (proposed)

| Layer | Technology |
| --- | --- |
| Client | Native or cross-platform Android app with SQLite; PWA for review and light capture |
| Speech | whisper.cpp with a quantized small model, fine-tuned Hindi model for Hindi |
| OCR | PaddleOCR / PP-OCRv5 for print; handwriting engines benchmarked on own samples |
| LLM | 2 to 4B int4 model via llama.cpp or LiteRT-LM |
| Retrieval | SQLite FTS + sqlite-vec, multilingual embedding model |
| Backend | FastAPI (Node.js alternative) |
| Database | PostgreSQL |
| Security | AES-GCM field encryption, TLS, hash-chained audit log |

## How sync works

1. Every edit is saved as an immutable **operation** with a unique `op_id`, device ID, patient ID, field path, base version and new value.
2. The client sends pending operations when online, using `op_id` as an idempotency key on every retry.
3. The server stores each `op_id` permanently. A repeated ID returns the stored result; the same ID with a different payload is rejected.
4. The server compares the operation's base version with the record's current version.
   - Same version: apply.
   - Different fields changed: merge and log.
   - Same field, or delete versus edit: save a **conflict record** and apply neither side.
5. A clinician resolves each conflict on a side-by-side screen. The decision is logged as an operation.
6. After sync, device and server compare per-patient checksums and the audit chain.

Transient network errors are retried with backoff. Validation and permission errors are shown to the user instead of retried.

## Proposed repository layout

```
offlinescribe/
├── app/                 # client (phone) application
│   ├── capture/         # audio and camera capture
│   ├── ai/              # speech, OCR, LLM, extraction, verification
│   ├── store/           # encrypted SQLite, FTS, vector index, operation log
│   ├── review/          # case-file review and conflict resolution UI
│   └── sync/            # sync client, retry and backoff
├── server/
│   ├── api/             # FastAPI sync endpoints, auth
│   ├── sync/            # dedupe table, version check, conflict records
│   └── db/              # PostgreSQL migrations
├── eval/                # test sets, fault-injection harness, metrics scripts
├── docs/                # PRD, design notes, research
├── PRD.md
└── README.md
```

## Getting started

These steps describe the intended developer flow once the scaffold exists. Replace placeholders as the project takes shape.

```bash
# 1. Clone
git clone <your-repo-url> offlinescribe && cd offlinescribe

# 2. Server (Python)
cd server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# set DATABASE_URL and a secret for tokens, then:
uvicorn api.main:app --reload

# 3. Client
# Follow app/README.md for the chosen framework (Android Studio, Flutter or React Native).
# Models are downloaded once and stored on the device:
#   - a quantized whisper.cpp model
#   - an OCR model
#   - an int4 LLM and an embedding model
```

## Testing

The sync engine is tested harder than anything else. Planned suites in `eval/`:

- **Fault injection:** drop the response after the server commits, duplicate and reorder deliveries, kill the app mid-sync. Expected result: zero duplicates, zero lost operations.
- **Conflict scenarios:** same field on two devices, different fields, delete versus edit, three devices. Expected result: zero silent overwrites.
- **Integrity:** checksum match after every sync, tamper detection on the audit chain.
- **AI quality:** field-level precision and recall on scripted visits; WER for speech (clean and noisy, Hindi and English); CER for OCR; hallucinated phrases per hour.
- **Device performance:** an 8-hour simulated clinic day on a low-end Android phone, tracking RAM, battery and temperature.

Use synthetic or de-identified data only. Never commit real patient data.

## Privacy and compliance

- Data is encrypted on the device and in transit. The README and PRD state which fields the server can read.
- The data model is shaped for HL7 FHIR R4 so a future export to India's ABDM is possible. v1 does not integrate with ABDM.
- India's DPDP Act 2023 applies; confirm current rules for health data on official sources before any deployment.

## Known limitations

- Handwritten prescription OCR is far from reliable; treat output as draft.
- Speech models can invent text, especially in noise or silence; the audio is kept until approval so errors stay catchable.
- Indic language accuracy depends on fine-tuned models and is weaker on spontaneous speech.
- Phones heat up under sustained LLM use; model size is chosen accordingly.

## Roadmap

1. Sync core and fault-injection harness
2. Encrypted local store, review UI, audit log
3. Voice path
4. Document path
5. Retrieval and history summaries
6. Conflict resolution UI and demo
7. Evaluation report

## Contributing

Open an issue before large changes. Keep patient-like data out of the repository and out of issue text.

## License

To be decided.
