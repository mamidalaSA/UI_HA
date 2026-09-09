# Running the Hospital Management System locally (no Docker)

This is a step‑by‑step guide for someone who has **never seen this codebase before** and
wants to get the whole thing running on their own machine (macOS, Apple Silicon or Intel).

The official `README.md` assumes Docker. This guide runs every piece **natively** with
Homebrew + a Python virtualenv + Node, which is what was actually used to bring the app up
on this machine on 2026‑09‑09.

---

## 1. What you are about to run

| Piece | Tech | Port | Required? |
|---|---|---|---|
| **PostgreSQL** | Postgres 16 | 5432 | ✅ yes – the database |
| **Redis** | Redis 7 | 6379 | ✅ yes – message broker for the alert engine |
| **Backend API** | FastAPI (Python 3.12) | 8000 | ✅ yes |
| **Web app** | React + Vite + TypeScript | 5173 | ✅ yes |
| **Celery worker** | Python | – | ⚠️ only for medication‑dose alerts |
| **Celery beat** | Python | – | ⚠️ only for medication‑dose alerts |
| **MinIO** | S3‑compatible file store | 9000 / 9001 | ⚠️ only for lab‑report file uploads |
| **Mobile app** | Expo / React Native | 8081 | ❌ optional, patient‑only |

Payments, SMS and push notifications are **mocked** – no external accounts needed. Sent
messages land in an in‑memory outbox you can read at `GET /api/admin/dev/sms-outbox` and
`GET /api/admin/dev/push-outbox` (admin token required).

---

## 2. Prerequisites

Install these once:

```bash
# Homebrew (skip if you already have it): https://brew.sh
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Runtimes
brew install node            # Node 20+ (22/25 fine) – for the web app
brew install python@3.12     # Python 3.12 – for the backend
```

Check versions:

```bash
node -v      # v20 or newer
python3 --version   # 3.12.x
```

---

## 3. Install & start the infrastructure (Postgres + Redis)

```bash
brew install postgresql@16 redis
brew services start postgresql@16
brew services start redis
```

`brew services` keeps them running and restarts them at login. Confirm:

```bash
brew services list        # postgresql@16 and redis should say "started"
redis-cli ping            # -> PONG
```

Add the Postgres client tools to your PATH for this shell (Homebrew keeps them
"keg‑only"):

```bash
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"   # Apple Silicon
# export PATH="/usr/local/opt/postgresql@16/bin:$PATH"    # Intel Macs
```

### Create the database and user

The app expects a database `hms` owned by a role `hms` / password `hms`
(see `backend/.env`):

```bash
psql -d postgres -c "CREATE ROLE hms WITH LOGIN PASSWORD 'hms' CREATEDB;"
psql -d postgres -c "CREATE DATABASE hms OWNER hms;"
```

Verify you can connect:

```bash
psql "postgresql://hms:hms@localhost:5432/hms" -c "\conninfo"
```

> **Reset later:** `psql -d postgres -c "DROP DATABASE hms;"` then re‑create and re‑run
> the migration + seed from step 4.

---

## 4. Backend (FastAPI)

```bash
cd backend

# 4a. Environment file – the repo already ships a working dev .env.example
cp -n .env.example .env

# 4b. Virtualenv + dependencies
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

> **Known fix already applied:** `requirements.txt` pins `bcrypt==4.0.1`. Newer bcrypt
> (5.x) breaks `passlib` 1.7.4 with a `password cannot be longer than 72 bytes` error
> during seeding. If you hit that, run `pip install 'bcrypt==4.0.1'`.

### 4c. Create the schema and load demo data

```bash
# still inside backend/, with the venv active
alembic upgrade head        # creates all ~40 tables from alembic/versions/
python seed.py              # departments, test catalogue, demo users, one demo patient
```

`seed.py` is idempotent – safe to run again. It prints the demo logins when done.

### 4d. Run the API

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API root / health: <http://localhost:8000/api/health> → `{"status":"ok",...}`
- **Swagger UI:** <http://localhost:8000/docs>
- ReDoc: <http://localhost:8000/redoc>

Quick login smoke test (new terminal):

```bash
curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@cityhospital.com","password":"Admin@123"}'
# -> {"access_token":"...","token_type":"bearer","role":"admin",...}
```

---

## 5. Web app (React)

Open a **new terminal** (leave the backend running):

```bash
cd web
npm install
npm run dev
```

- Web app: <http://localhost:5173>

The web app reads the API base URL from `VITE_API_BASE_URL` and falls back to
`http://localhost:8000` (see `web/src/api/client.ts`), so no config is needed for the
default local setup. To point it elsewhere, create `web/.env`:

```
VITE_API_BASE_URL=http://localhost:8000
```

Log in at <http://localhost:5173> with any account from the table below. The app routes
you to the dashboard for that role.

---

## 6. Demo logins (created by `seed.py`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@cityhospital.com` | `Admin@123` |
| Receptionist | `reception@cityhospital.com` | `Reception@123` |
| Doctor (Cardiology) | `doctor.verma@cityhospital.com` | `Doctor@123` |
| Doctor (Neurology) | `doctor.joshi@cityhospital.com` | `Doctor@123` |
| Head Nurse (General Ward) | `nurse@cityhospital.com` | `Nurse@123` |
| Lab Staff | `lab@cityhospital.com` | `Lab@123` |
| Pharmacist | `pharmacy@cityhospital.com` | `Pharmacy@123` |

There is one demo inpatient, **Ravi Kumar** (General Ward, assigned to Dr. Verma), so the
doctor and nurse dashboards aren't empty.

**OTP for every mobile‑verification flow is the fixed dev code `123456`**
(`OTP_STATIC_CODE` in `backend/.env`).

---

## 7. Alert engine (Celery) – optional

Needed only if you want medication‑dose alerts / escalations to actually fire. The rest of
the app works without it.

Two more terminals, each `cd backend && source .venv/bin/activate` first:

```bash
# terminal A – worker (generates dose alerts when a prescription is saved)
celery -A app.core.celery_app worker --loglevel=info

# terminal B – beat (sweeps every minute: SCHEDULED -> FIRED -> MISSED -> escalate)
celery -A app.core.celery_app beat --loglevel=info
```

Redis (step 3) must be running.

---

## 8. File storage (MinIO) – optional

Needed only for **lab report file uploads** (`app/modules/labs`). Everything else works
without it; upload calls will just error.

```bash
brew install minio
mkdir -p ~/.minio-data
MINIO_ROOT_USER=hms_minio MINIO_ROOT_PASSWORD=hms_minio_secret \
  minio server ~/.minio-data --console-address ":9001"
```

- S3 endpoint: `localhost:9000`
- Console: <http://localhost:9001> (`hms_minio` / `hms_minio_secret`)

The credentials and bucket name (`hms-files`) are already in `backend/.env`. Create the
bucket once from the console, or the backend will create it on first use.

---

## 9. Mobile app (Expo) – optional, patient‑only

```bash
cd mobile
npm install
npx expo start
```

Press `i` for the iOS simulator or `a` for Android. It talks to `http://localhost:8000`.
On a **physical device**, change `API_BASE_URL` in `mobile/src/api/client.ts` to your
machine's LAN IP (e.g. `http://192.168.1.20:8000`).

---

## 10. Daily start / stop cheat‑sheet

**Start everything:**

```bash
# infra (usually already running via brew services)
brew services start postgresql@16 redis

# backend  (terminal 1)
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# web      (terminal 2)
cd web && npm run dev

# alerts   (terminals 3 & 4, optional)
cd backend && source .venv/bin/activate && celery -A app.core.celery_app worker -l info
cd backend && source .venv/bin/activate && celery -A app.core.celery_app beat  -l info
```

**Stop everything:**

```bash
# Ctrl‑C in each app terminal, then if you want the infra down too:
brew services stop postgresql@16
brew services stop redis
```

---

## 11. Project layout (where to look)

```
backend/
  app/
    main.py                 FastAPI app + router registration
    core/                   config, security/JWT, RBAC deps, audit log, celery app
    db/                     SQLAlchemy Base, session, all_models (import hub)
    modules/<name>/         one folder per domain:
        models.py           SQLAlchemy tables
        schemas.py          Pydantic request/response models
        service.py          business logic
        router.py           HTTP endpoints
    integrations/           payments / sms / push (mock impls) + storage (MinIO)
    workers/                Celery tasks: alert_tasks.py, housekeeping_tasks.py
  alembic/                  DB migrations (alembic upgrade head)
  seed.py                   demo data
  .env                      local config (gitignored; copied from .env.example)

web/
  src/
    api/client.ts           axios instance, base URL, auth header
    modules/<role>/         one folder per role UI (reception, doctor, nurse, lab,
                            pharmacy, admin) – api.ts + pages/components
    router / App            role-based routing

mobile/                     Expo patient app
docs/HMS_Build_Spec.md      the functional spec – source of truth for workflows/rules
```

Modules: `auth`, `patients`, `doctors`, `nurses`, `labs`, `pharmacy`, `transfers`,
`admin`, `patient_app`. ~84 API operations total – browse them all at `/docs`.

---

## 12. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `psql: command not found` | Add `/opt/homebrew/opt/postgresql@16/bin` to `PATH` (step 3). |
| `connection refused` on port 5432 | `brew services start postgresql@16`; check `brew services list`. |
| `password authentication failed for user "hms"` | Role not created or wrong password – re‑run the `CREATE ROLE` in step 3. `DATABASE_URL` in `.env` must be `postgresql+psycopg://hms:hms@localhost:5432/hms`. |
| `password cannot be longer than 72 bytes` during `python seed.py` | bcrypt 5.x vs passlib – `pip install 'bcrypt==4.0.1'`. |
| `alembic upgrade head` says "Target database is not up to date" | You already ran it; check `alembic current`. To start clean: drop & recreate the `hms` database. |
| Backend starts but web shows network errors | Backend not on :8000, or `VITE_API_BASE_URL` points elsewhere. CORS is open (`*`) so that's not it. |
| Celery: `Connection refused` to redis | `brew services start redis`; `redis-cli ping` → `PONG`. |
| Lab report upload fails | MinIO not running – step 8 (or ignore if you don't need uploads). |
| Port already in use | Something's still running: `lsof -i :8000` / `:5173` then `kill <pid>`. |

---

## 13. What was verified working on this machine (2026‑09‑09)

- Postgres 16 + Redis 7 via Homebrew services
- `alembic upgrade head` → all tables created
- `python seed.py` → demo users + reference data loaded
- `uvicorn app.main:app` → `/api/health` OK, `/api/auth/login` returns a JWT for every
  demo role, `/api/doctor/patients` returns the demo inpatient with a doctor token
- `npm run dev` → web app served on :5173 (HTTP 200)
- Celery worker + beat connect to Redis and report `ready`
- MinIO and the mobile app were **not** started here (optional pieces)
