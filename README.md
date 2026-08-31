# City Hospital — Hospital Management System

A role-based hospital management system: reception, doctors, head nurses, lab staff,
pharmacists, admin, and a patient mobile app, all wired to one backend. Built from
`docs/HMS_Build_Spec.md` — that file remains the source of truth for workflows/rules.

## Stack

- **Backend**: FastAPI + SQLAlchemy 2.0 + PostgreSQL, Celery + Redis for the alert engine
- **Web**: React + TypeScript + Tailwind + React Router, one folder per role module
- **Mobile**: Expo (React Native + TypeScript), patient-only
- **File storage**: MinIO (real, self-hosted — not mocked)
- **Payment / SMS / Push**: mocked behind provider interfaces (see below) — no real
  Razorpay/Twilio/Firebase account needed to run and exercise every workflow

## Repo layout

```
backend/   FastAPI app — app/modules/<name>/{models,schemas,service,router}.py per module
web/       React web app — src/modules/<name>/ per role
mobile/    Expo app — patient role only
docker-compose.yml
```

## Prerequisites

- Docker Desktop (runs Postgres, Redis, MinIO, and can run the backend/web containers too)
- Node.js 20+ (only if you want to run `web/`/`mobile/` outside Docker)
- Python 3.12+ (only if you want to run the backend outside Docker)

> This project was built in a sandbox with no Docker/Node available, so none of it has
> been executed end-to-end yet. The backend's Python code was verified to import cleanly
> (all 88 routes across every module load with zero path collisions) using a local
> venv — but nobody has hit a live Postgres yet. Follow the steps below on a machine with
> Docker to actually boot it; you're the first real run.

## First run

```bash
cd hms
cp backend/.env.example backend/.env   # already done in this repo, edit if you want real API keys later

docker compose up -d postgres redis minio
docker compose run --rm backend alembic revision --autogenerate -m "initial schema"
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python seed.py

docker compose up -d backend celery-worker celery-beat web
```

- Backend: http://localhost:8000 (docs at `/docs`)
- Web app: http://localhost:5173
- MinIO console: http://localhost:9001 (user `hms_minio` / password `hms_minio_secret`)

To stop: `docker compose down` (add `-v` to also drop the Postgres volume).

### Demo logins (created by `seed.py`)

| Role | Email | Password |
|---|---|---|
| Admin | admin@cityhospital.com | Admin@123 |
| Receptionist | reception@cityhospital.com | Reception@123 |
| Doctor (Cardiology) | doctor.verma@cityhospital.com | Doctor@123 |
| Doctor (Neurology) | doctor.joshi@cityhospital.com | Doctor@123 |
| Head Nurse (General Ward) | nurse@cityhospital.com | Nurse@123 |
| Lab Staff | lab@cityhospital.com | Lab@123 |
| Pharmacist | pharmacy@cityhospital.com | Pharmacy@123 |

The seed also creates one demo inpatient (Ravi Kumar, General Ward, assigned to Dr. Verma)
so the nurse/doctor dashboards aren't empty on first login.

OTP for any mobile-verification flow (patient registration, reception activation, patient
app registration) is a fixed dev code: **`123456`** (see `OTP_STATIC_CODE` in `.env`).

## Running the mobile app

```bash
cd mobile
npm install
npx expo start
```

Uses `http://localhost:8000` as the API base — if testing on a physical device (not an
emulator), change `API_BASE_URL` in `src/api/client.ts` to your machine's LAN IP.

## Running things individually (without Docker)

**Backend:**
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # (or source .venv/bin/activate on mac/linux)
pip install -r requirements.txt
# make sure Postgres/Redis/MinIO are reachable per .env
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
python seed.py
uvicorn app.main:app --reload
# in separate terminals:
celery -A app.core.celery_app worker --loglevel=info
celery -A app.core.celery_app beat --loglevel=info
```

**Web:**
```bash
cd web
npm install
npm run dev
```

## Architecture notes

- **Mocked integrations, real MinIO**: Razorpay/Twilio-MSG91/FCM are all behind small ABC
  interfaces in `backend/app/integrations/` with a `Mock*` implementation wired by default
  (`PAYMENT_PROVIDER=mock` / `SMS_PROVIDER=mock` / `PUSH_PROVIDER=mock` in `.env`). Sent
  SMS/push messages land in an in-memory outbox, viewable at
  `GET /api/admin/dev/sms-outbox` and `/dev/push-outbox` (admin-only) for testing without
  a real account. File storage uses a real, self-hosted MinIO container — no mocking
  needed there since it runs entirely locally.
- **Alert engine** (`backend/app/workers/`): a Celery task generates every dose alert for
  a prescription's full course on save/revise; Celery Beat sweeps every minute to advance
  SCHEDULED → FIRED → MISSED and fires escalations. Runs as its own containers
  (`celery-worker`, `celery-beat`) so it survives API restarts, per the spec's requirement.
- **RBAC**: JWT + role claim, checked via FastAPI dependencies in `app/core/deps.py` and
  `app/core/ownership.py` (doctor-owns-patient / nurse-owns-ward checks). Reference/config
  data under `/api/admin/*` (departments, test catalogue, etc.) is readable by any
  authenticated staff role — only writes and sensitive reads (user list, audit log) are
  admin-gated.
- **Audit log**: every write endpoint calls `record_audit(...)` (`app/core/audit.py`)
  before committing, per the spec's security rule.
- **Multi-agent build**: this codebase was built by parallel agents, one per module, each
  working only inside its own `app/modules/<name>/` and `web/src/modules/<name>/` folder
  against a shared, pre-existing set of database models — see git history / commit
  messages for what each covered. A few cross-module integration issues found during
  review (a stale router import, a non-nullable FK that needed relaxing, admin endpoints
  over-restricting reference-data reads) were fixed centrally afterward.

## Known gaps / where this diverges from a literal reading of the spec

- No real PDF generation for transfer discharge summaries — `POST /transfers/{id}/summary`
  stores a stub URL (`discharge-summaries/{id}.pdf`), ready to swap for a real renderer.
- Bed management, appointment scheduling, and per-medicine billing pricing aren't in the
  spec's schema at all; where the reference screenshots show them, the UI renders them as
  clearly-commented static/demo panels rather than inventing new backend tables.
- "Sorted by urgency" (doctor patient list) has no urgency field in the spec — approximated
  as inpatient-first, then admission time.
- See each module's git history / the agent reports in this build's transcript for the
  full list of documented assumptions where the spec was ambiguous.


Running Step : 
1: run the UI : 
cd /path/to/HAP/UI_HA
npm create vite@latest web -- --template react-ts
cd web
npm install
npm run dev

2: running fastAPI
cd /path/to/HAP/UI_HA/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

API for swagger page : http://localhost:8000/docs

