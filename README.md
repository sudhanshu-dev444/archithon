# Swasthya Sync — Offline-First Multimodal AI Healthcare Assistant (PS04)

Production-grade React web application built from Google Stitch designs for rural clinical field outposts (Ganiyari Health Outpost).

Designed for zero-connectivity environments with local SQLite persistence, on-device ambient dictation, edge OCR prescription processing, and conflict-aware differential synchronization.

---

## 🚀 Live Demo & Quick Start

### Prerequisites
- Node.js 18+ & npm

### Running Locally

```bash
# Navigate to the application directory
cd Swasthya_sync/swasthya-sync-app

# Install dependencies (already installed if cloning checkout)
npm install

# Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 📱 Screen Inventory & Routes

| # | Screen Name | Route | Key Capabilities |
|---|---|---|---|
| **S1** | **Doctor Login & Quick PIN** | `/login` | Doctor ID/Passphrase login, 6-digit Quick PIN numpad with auto-advance, Code Blue Emergency Triage Bypass |
| **S2** | **Staff Registration** | `/register` | 3-step medical officer registration, council & specialty pickers, biometric keycard binding |
| **S3** | **Offline Patient Directory & RAG** | `/patients` | Instant offline search across 248 records, Triage Queue (Critical/Urgent/Routine), Active Allergy Guard banner |
| **S4** | **Patient Medical Record & Timeline** | `/patients/:id` | 2x2 vitals grid with baseline comparison, consultation history timeline, documented adverse drug event callout |
| **S5** | **Multimodal Clinical Intake** | `/patients/:id/intake` | 16-bar real-time audio waveform animation, Hindi/English live translation stream, Edge OCR slip scanner, Drug conflict guard |
| **S6** | **Clinical Case Review & Sign-off** | `/patients/:id/review` | AI provenance badges ("Suggested from dictation"), ICD-10 coders, Critical Allergy Conflict reject/adopt card, Doctor verification checkbox |
| **S7** | **Differential Sync & Conflict Inspector** | `/sync` | Two-way partition collision inspector, side-by-side diff (This Clinic vs District Hospital), 3-way merge resolution, Outbox queue |

---

## 🛠️ Architecture & Tech Stack

- **Framework**: React 18 + Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS v3 with exact tokens from `DESIGN.md`
  - Primary: `#003441` (Deep Forest Teal)
  - Secondary: `#3a6472`
  - Tertiary / Emergency: `#660200` / `#ba1a1a`
  - Surface: `#f8f9ff`
- **Typography**: Inter (Google Fonts) with tabular numbers for vitals
- **Icons**: Google Material Symbols Outlined
- **State Management**: React Context + useReducer
  - `AuthContext`: Clinician identity, PIN session, Emergency Bypass auditing
  - `PatientContext`: Local cache of 248 patient records with instant offline querying
  - `SyncContext`: Offline outbox, pending queues, differential collision counts
- **Mock Data**: Rich JSON stores in `src/data/` for patients, encounters, and formulary contraindications

---

## 🛡️ Critical Clinical Safety Rules

1. **Deterministic Allergy Checking**: The drug-allergy conflict engine evaluates against local patient history (e.g. Sunita Devi PAT-8812's severe Penicillin anaphylaxis). It warns immediately when Amoxicillin or beta-lactams are detected from OCR or dictation, suggesting safe formulary alternatives (Azithromycin 500mg).
2. **Explicit Clinician Sign-off**: No AI draft can be automatically committed into the clinical record without the clinician checking the Doctor Verification box and clicking "Save & Approve Record".
3. **Traceability**: All synthesized sections display provenance tags indicating their origin (e.g., `Suggested from dictation`, `Confidence: 96%`).
