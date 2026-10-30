# Swasthya Sync — Backend API

Node.js / Express sync engine backend for the Offline-First Multimodal Clinical Assistant (PS04).

## Stack
- **Runtime**: Node.js 18+ (ESM)
- **Framework**: Express 4
- **Database**: SQLite via `better-sqlite3` (swap to PostgreSQL for production)
- **Auth**: SHA-256 token sessions (replace with JWT + RS256 in production)

## Folder structure

```
backend/
  server.js              # Entry point, route mounting
  db/
    schema.js            # SQLite schema init + getDb()
    seed.js              # Demo data seed
  middleware/
    auth.js              # requireAuth, requireRole, generateToken
  services/
    auditService.js      # Hash-chained audit log writer
    allergyChecker.js    # Drug-allergy cross-reactivity checker
    syncService.js       # Core sync engine: push/pull/verify/conflict
  routes/
    auth.js              # /auth/* + /admin/devices/*
    patients.js          # /patients/* + encounters + prescriptions
    sync.js              # /sync/* + /conflicts/* + /audit
```

## Quick start

```bash
cd backend
npm install
node server.js   # runs on http://localhost:4000
```

## Key API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| POST | `/auth/register` | Register doctor |
| POST | `/auth/login` | Login → token |
| POST | `/auth/login/pin` | Quick PIN login |
| POST | `/auth/emergency` | Emergency bypass session |
| GET | `/auth/me` | Current session info |
| GET | `/patients` | Patient list (`?q=&triage=critical`) |
| POST | `/patients` | Create patient |
| GET | `/patients/:id` | Patient detail + allergies + encounters |
| POST | `/patients/:id/encounters` | New encounter |
| PATCH | `/patients/:id/encounters/:enc_id` | Update/approve encounter |
| POST | `/patients/:id/encounters/:enc_id/allergy-check` | Drug-allergy check |
| **POST** | **`/sync/push`** | **Push operation batch** |
| **GET** | **`/sync/pull`** | **Pull new ops since cursor** |
| GET | `/sync/verify` | Per-patient convergence checksum |
| GET | `/sync/status` | Pending count, open conflicts |
| GET | `/sync/conflicts` | List open conflicts |
| GET | `/sync/conflicts/:id` | Conflict detail + version history |
| POST | `/sync/conflicts/:id/resolve` | Resolve conflict (keep_a/keep_b/merge) |
| GET | `/sync/audit` | Paginated audit log |
| POST | `/admin/devices/:id/revoke` | Revoke a device |

## Demo credentials

| Field | Value |
|-------|-------|
| Email | `priya.sharma@ganiyari.in` |
| Passphrase | `demo1234` |
| PIN | `123456` |
| Device ID | `DEVICE-GANIYARI-ALPHA` |

## Sync engine overview

The sync engine implements the spec from `Sync_Engine_Mechanics.md`:

1. **`POST /sync/push`** — Client sends a batch of operations (each with a `op_id` idempotency key). The server processes each in a transaction: checks `processed_operations` for duplicates, detects version conflicts, applies or stores conflict, then writes to `processed_operations`.

2. **`GET /sync/pull`** — Returns all operations with `server_seq > since` (excluding same device). Client advances its cursor.

3. **Conflict detection** — If `base_version < current server version` AND the same field is changed, a `conflicts` row is created. The operation is NOT applied. The client receives `status: "conflict"`.

4. **Conflict resolution** — `POST /sync/conflicts/:id/resolve` with strategy `keep_a | keep_b | merge`. Creates a RESOLVE operation through the normal push path.

5. **Audit chain** — Every action writes a hash-chained `audit_log` entry. The chain is verifiable.

