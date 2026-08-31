# Hospital Management System — Build Specification

> Hand this document to Claude Code or any AI coding assistant. It contains everything needed to build the full application.

---

## What we are building

A web + mobile application for hospitals. It connects reception, doctors, nurses, pharmacy, labs, and patients into one system. Everything is role-based — each login sees only what is relevant to that role.

---

## Tech stack

- **Backend**: Node.js (Express) or Python (FastAPI) — choose one
- **Database**: PostgreSQL
- **Web frontend**: React (TypeScript) with Tailwind CSS
- **Mobile app**: React Native or Flutter (for patients only)
- **Job queue**: BullMQ (Node) or Celery + Redis — for medication alerts
- **Push notifications**: Firebase Cloud Messaging (FCM)
- **SMS**: MSG91 or Twilio
- **Payment**: Razorpay (India) or Stripe
- **File storage**: AWS S3 or MinIO (for PDF reports, DICOM images)
- **Auth**: JWT with role-based middleware

---

## User roles

| Role | Access |
|------|--------|
| Admin | Full access to everything |
| Receptionist | Patient registration and payment only |
| Doctor | Own assigned patients only |
| Head Nurse | Ward patients — medication and vitals only |
| Lab Staff | Test queue — upload results only |
| Pharmacist | Prescription queue — dispense only |
| Patient | Own records and medication reminders only |

---

## Module 1 — Reception

### What it does
Registers patients, collects payment, assigns doctor.

### Three ways a patient enters the system

**1. Emergency walk-in**
- Receptionist fills all fields immediately
- Profile status = `active` right away
- Payment can be deferred (mark as `deferred`)
- FIR number field appears if "medico-legal" toggle is ON

**2. Phone appointment**
- Receptionist fills form during the phone call
- Profile status = `draft` (doctors cannot see it yet)
- When patient arrives — receptionist searches by name/mobile — flips status to `active`
- System sends appointment confirmation SMS when draft is saved

**3. Website booking**
- Patient fills form on hospital website
- Profile status = `pending`
- Patient receives OTP to verify mobile number
- Receptionist reviews, edits if needed, approves — status becomes `active`

### Payment
- When profile becomes `active`, system generates a payment order via Razorpay
- SMS with payment link sent to patient's registered mobile
- Link expires in 2 hours
- Receptionist screen shows "Resend link" button if not paid in 30 min
- Offline payment: receptionist enters receipt number manually
- Emergency patients: payment_status = `deferred`, collected before discharge

### Auto-assignment
When profile activates, system auto-assigns doctor + department:
1. Match `chief_complaint` text against `specialty_mapping` table
2. Look up which department handles that specialty
3. Find available doctors on duty in that department today
4. Pick doctor with fewest active patients (load balancing)
5. Write `doctor_id` and `department_id` to patient profile
6. Send push notification to assigned doctor

### Key business rules
- Draft profiles expire after 48 hours (background job)
- FIR number is write-once — cannot be edited after saving
- Mobile number must be OTP-verified before profile can be activated
- Only one active profile per patient per day

### Database table: `patients`

```
id                  UUID PK
full_name           VARCHAR(120)     required
date_of_birth       DATE             required
gender              ENUM(M,F,Other)  required
id_number           VARCHAR(20)      required  -- Aadhaar/passport
blood_group         VARCHAR(5)
mobile              VARCHAR(15)      required, OTP-verified
email               VARCHAR(120)
address             TEXT
emergency_name      VARCHAR(120)     required
emergency_phone     VARCHAR(15)      required
intake_channel      ENUM(emergency, phone, website)  auto-set
profile_status      ENUM(draft, pending, active, discharged, expired)  auto-set
admission_type      ENUM(inpatient, outpatient, day-care)  required
chief_complaint     TEXT             required
medico_legal        BOOLEAN          default false
fir_number          VARCHAR(40)      required if medico_legal = true, write-once
department_id       FK → departments  auto-set
doctor_id           FK → doctors      auto-set, receptionist can override
admitted_at         TIMESTAMP         auto-set on activation
consult_fee         DECIMAL(10,2)     auto-set from department fee table
payment_method      ENUM(online, offline)
payment_status      ENUM(pending, link_sent, paid, deferred, waived)  auto-set
payment_link        VARCHAR(255)      auto-set
payment_link_expires TIMESTAMP        auto-set (admitted_at + 2 hours)
receipt_number      VARCHAR(40)       required for offline payments
collected_by        FK → users        receptionist who took offline payment
created_at          TIMESTAMP         auto
updated_at          TIMESTAMP         auto
```

---

## Module 2 — Admin

### What it does
Full read/write access to everything. Configuration and reporting.

### Features
- Create, edit, deactivate any user account
- Assign and change user roles
- Manage departments and specialties
- Manage doctor roster (who is on duty, which days, max patients)
- Manage `specialty_mapping` table (keyword → specialty)
- Manage `test_catalogue` (available tests, departments, expected TAT)
- Manage `medicine_formulary` (approved medicines list)
- Manage `department_fees` (consultation fee per department)
- Configure `vitals_config` (normal range per vital, per patient type)
- Configure alert windows (how long before MISSED fires)
- View all patient records
- View all financial reports
- View full audit trail
- Override any auto-assignment
- Approve external patient transfers
- Override transfer decline decisions

---

## Module 3 — Doctor

### Workflow

1. Doctor logs in — sees list of assigned patients, sorted by urgency
2. Opens a patient — sees admission details, prior notes, test history
3. Writes examination notes — saved with timestamp
4. Orders tests — test_orders records created, lab notified
5. Waits for results — in-app alert fires when results ready
6. Reviews results — marks as REVIEWED
7. Writes prescription — alert engine schedules all doses
8. Can revise prescription — new version created, old archived, alerts rescheduled
9. Confirms discharge — all pending alerts cancelled

### Rules
- Doctor only sees patients assigned to them
- Cannot log a dose (that is the nurse's job)
- Cannot process a test (that is the lab's job)
- Cannot modify prescription after transferring the patient
- Discharge requires at least one examination note on record

### Database table: `prescriptions`

```
id                  UUID PK
patient_id          FK → patients  required
doctor_id           FK → doctors   required
version             INTEGER        starts at 1, increments on revision
is_active           BOOLEAN        only one true at a time
notes               TEXT           general prescription notes
created_at          TIMESTAMP
archived_at         TIMESTAMP      set when a new version supersedes this one
```

### Database table: `prescription_lines` (one row per medicine)

```
id                  UUID PK
prescription_id     FK → prescriptions  required
medicine_name       VARCHAR(120)
dosage              VARCHAR(40)         e.g. "500mg"
route               ENUM(oral, IV, IM, topical, inhalation)
frequency           ENUM(once_daily, twice_daily, thrice_daily, every_6h, every_8h, as_needed)
start_date          DATE
duration_days       INTEGER
with_food           BOOLEAN
special_instructions TEXT
```

### Frequency to time slots
```
once_daily     → [08:00]
twice_daily    → [08:00, 20:00]
thrice_daily   → [08:00, 14:00, 20:00]
every_6h       → [06:00, 12:00, 18:00, 00:00]
every_8h       → [06:00, 14:00, 22:00]
as_needed      → no scheduled slots, manual only
```

### Database table: `test_orders`

```
id                  UUID PK
patient_id          FK → patients
doctor_id           FK → doctors       ordering doctor
test_type_id        FK → test_catalogue
status              ENUM(pending, in_progress, completed, reviewed, cancelled)
ordered_at          TIMESTAMP
result_text         TEXT
result_file_url     VARCHAR(255)       PDF or DICOM in S3
completed_at        TIMESTAMP
reviewed_at         TIMESTAMP
notes               TEXT
```

---

## Module 4 — Head Nurse

### Workflow

1. Nurse logs in — sees dose schedule for all admitted patients on their ward
2. System fires in-app alert 15 minutes before each dose is due
3. Nurse opens alert — sees patient name, medicine, dosage, route, instructions
4. Nurse administers dose
5. Nurse taps "Mark given" in app — `medication_log` record created
6. If dose not marked given within 30 minutes — status becomes MISSED — escalation sent to doctor
7. Nurse records vitals each ward round
8. System auto-flags vitals outside normal range — sends alert to doctor

### Rules
- Nurse cannot write a prescription
- Nurse cannot order tests
- Nurse sees only patients in their ward
- Skipped doses require a skip reason

### Database table: `medication_log`

```
id                  UUID PK
alert_id            FK → alerts
prescription_line_id FK → prescription_lines
patient_id          FK → patients
administered_by     FK → users         the nurse
administered_at     TIMESTAMP          actual time given
dose_given          VARCHAR(40)        defaults to prescribed, editable if partial
route_used          ENUM               defaults to prescribed route
skipped             BOOLEAN            default false
skip_reason         TEXT               required if skipped = true
notes               TEXT
```

### Database table: `vitals`

```
id                  UUID PK
patient_id          FK → patients
recorded_by         FK → users
recorded_at         TIMESTAMP
temperature_c       DECIMAL(4,1)
bp_systolic         SMALLINT
bp_diastolic        SMALLINT
pulse_bpm           SMALLINT
spo2_pct            SMALLINT
resp_rate           SMALLINT
blood_glucose       DECIMAL(5,1)
gcs_score           SMALLINT
flagged             BOOLEAN     auto-set if any reading outside normal range
flag_reason         TEXT        auto-set, lists which fields triggered the flag
```

### Normal ranges (store in vitals_config table, NOT hardcoded)
```
temperature_c:  36.1 – 37.2
bp_systolic:    90 – 120
bp_diastolic:   60 – 80
pulse_bpm:      60 – 100
spo2_pct:       95 – 100
resp_rate:      12 – 20
blood_glucose:  70 – 140
```

---

## Module 5 — Alert Engine

### What it does
Background service. When a prescription is saved (or revised), it generates all dose alerts for the full course.

### Algorithm

```
For each prescription_line in the prescription:
  For each day from start_date to start_date + duration_days - 1:
    For each slot in frequency_slots[line.frequency]:
      Create one alert row:
        patient_id    = prescription.patient_id
        prescription_line_id = line.id
        scheduled_date = the date
        slot_time      = the time
        fire_at        = scheduled_date + slot_time - 15 minutes
        expire_at      = scheduled_date + slot_time + 30 minutes
        status         = SCHEDULED
        route_to       = "nurse" if patient.admission_type = inpatient
                         "patient_app" if outpatient or day-care
```

### Alert status machine
```
SCHEDULED → fires at fire_at → FIRED
FIRED → nurse/patient acknowledges → ACKNOWLEDGED
ACKNOWLEDGED → dose logged → GIVEN
FIRED or ACKNOWLEDGED → expire_at passes without GIVEN → MISSED
MISSED → escalation alert sent to doctor
SCHEDULED → prescription revised or patient discharged → CANCELLED
```

### On prescription revision
1. Cancel (status → CANCELLED) all SCHEDULED alerts for the old version
2. Run the algorithm above for the new version

### Rules
- Unique constraint on (prescription_line_id, scheduled_date, slot_time) — prevents duplicates if engine runs twice
- Use a job queue (BullMQ or Celery), not cron — jobs must survive server restarts
- Dead-letter queue for jobs that fail 3 times — alert ops team
- All times stored in UTC, displayed in local time

---

## Module 6 — Pharmacy

### Workflow

1. Doctor saves prescription — appears in pharmacy queue immediately
2. Pharmacist sees queue sorted by admission time
3. Pharmacist prepares medication, checks stock
4. If out of stock — system flags it
5. Pharmacist marks as DISPENSED — stock deducted — billing entry created — nurse notified
6. Low-stock alert fires when any medicine goes below its minimum threshold

### Database tables needed
```
pharmacy_prescriptions   -- link between prescription and dispensing status
stock_items              -- medicine name, quantity, batch, expiry, min_threshold
dispense_log             -- what was dispensed, when, by whom
billing_entries          -- auto-created on dispense
```

### Rules
- Each dispense deducts from stock
- Batch number and expiry date tracked
- Expired stock flagged at start of each day (background job)
- Returns and wastage must be logged

---

## Module 7 — Labs & Imaging

### Workflow

1. Doctor orders tests — test_orders record created, status = PENDING
2. Lab staff see queue in their dashboard
3. Lab staff mark test IN_PROGRESS (sample collected / scan started)
4. Lab uploads result (text + optional PDF/DICOM file)
5. Status → COMPLETED, doctor receives push notification
6. Doctor reviews — marks REVIEWED

### Test catalogue (Admin-configurable)
```
Blood test (CBC, LFT, RFT)  → Pathology      → 2–6 hrs
MRI                          → Radiology      → same day
CT scan                      → Radiology      → 2–4 hrs
X-ray                        → Radiology      → 1–2 hrs
Ultrasound                   → Radiology      → 1–3 hrs
ECG                          → Cardiology     → 30 min
Urine / stool analysis       → Pathology      → 2–4 hrs
```

### Rules
- Doctor can only cancel a test while status = PENDING
- Lab cannot modify a result after uploading (Admin only)
- TAT tracked per test type for performance reports

---

## Module 8 — Patient Mobile App

### Who uses it
Patients who are NOT admitted (outpatient or day-care).

### Features
1. Register with Patient ID + mobile number — OTP verification
2. View current active prescription
3. View today's dose schedule
4. Receive push notification 5 minutes before each dose
5. Tap "I took this" — logged to system as GIVEN
6. View medication history

### Missed dose escalation
```
First missed dose:
  → Alert sent to prescribing doctor (push + SMS)

Two consecutive missed doses in 24 hours:
  → Alert sent to doctor AND patient's emergency contact (SMS)
```

### Alert routing rule
```
if patient.admission_type == "inpatient":
  route alerts to Head Nurse in-app dashboard
else:  # outpatient or day-care
  route alerts to patient mobile app
```

---

## Module 9 — Patient Transfer

### When to use it
Doctor examines patient and decides the case is outside their specialty.

### Two types

**Internal transfer (same hospital, different department)**
1. Doctor opens patient record — taps "Transfer patient"
2. Selects department + enters reason (min 20 chars) + handover notes
3. System auto-assigns available doctor in receiving department
4. Receiving doctor gets push notification with case summary
5. Receiving doctor accepts — patient record ownership transfers
6. Receiving doctor declines with reason — original doctor notified, picks again
7. After 3 declines — Admin auto-alerted
8. Original doctor keeps READ-ONLY access after transfer

**External transfer (different hospital)**
1. Doctor selects External, picks hospital name, sets urgency (routine / urgent / emergency)
2. Doctor writes full clinical summary
3. Admin receives approval request
4. Admin approves — arranges transport
5. System generates discharge summary PDF
6. Patient transported, record marked as externally transferred
7. Emergency urgency — skip Admin approval, generate summary in parallel

### Rules
- No circular transfers: if patient came from Dept A → Dept B, Dept B cannot transfer back to Dept A without Admin override
- Cannot initiate transfer without at least one examination note on record
- One active transfer at a time per patient
- Transfer records cannot be deleted, only cancelled with a reason

### Database table: `patient_transfers`

```
id                   UUID PK
patient_id           FK → patients
from_doctor_id       FK → doctors
from_dept_id         FK → departments
transfer_type        ENUM(internal, external)
to_dept_id           FK → departments     internal only
to_doctor_id         FK → doctors         auto-assigned
to_hospital_name     VARCHAR(120)         external only
to_hospital_contact  VARCHAR(120)
urgency              ENUM(routine, urgent, emergency)
transfer_reason      TEXT                 required, min 20 chars
handover_notes       TEXT
status               ENUM(pending, accepted, declined, completed, cancelled)
decline_reason       TEXT
admin_approved_by    FK → users
discharge_summary_url VARCHAR(255)
initiated_at         TIMESTAMP
accepted_at          TIMESTAMP
completed_at         TIMESTAMP
```

---

## API overview

All endpoints require JWT auth header. Role is checked in middleware before the handler runs.

### Authentication
```
POST /api/auth/login         — returns JWT token
POST /api/auth/otp/send      — send OTP to mobile
POST /api/auth/otp/verify    — verify OTP, return token
```

### Reception endpoints
```
POST   /api/patients                    — create patient profile
GET    /api/patients?status=pending     — list pending profiles
GET    /api/patients?status=draft       — list draft profiles
GET    /api/patients/:id                — get full profile
PATCH  /api/patients/:id/activate       — flip draft → active
PATCH  /api/patients/:id/confirm        — receptionist confirms website profile
POST   /api/payments/initiate           — generate Razorpay order + send SMS link
POST   /api/payments/webhook            — payment gateway callback (idempotent)
PATCH  /api/payments/offline            — record cash/card payment
POST   /api/assign                      — run auto-assignment for patient
```

### Doctor endpoints
```
GET    /api/doctor/patients             — list assigned patients
POST   /api/patients/:id/notes         — save examination notes
POST   /api/patients/:id/tests         — order diagnostic tests
PATCH  /api/tests/:id/review           — mark test result reviewed
POST   /api/patients/:id/prescriptions — create or revise prescription
GET    /api/patients/:id/prescriptions — list all versions
PATCH  /api/patients/:id/discharge     — confirm discharge
POST   /api/patients/:id/transfer      — initiate transfer
```

### Head Nurse endpoints
```
GET    /api/nurse/alerts                — active dose alerts for ward
PATCH  /api/alerts/:id/acknowledge     — nurse opens alert
POST   /api/alerts/:id/log             — log dose given or skipped
POST   /api/patients/:id/vitals        — record vitals
GET    /api/patients/:id/vitals        — vitals history
GET    /api/patients/:id/medication-log — full medication history
POST   /api/escalations                — manually escalate to doctor
```

### Lab endpoints
```
GET    /api/lab/queue                  — work queue for lab staff
PATCH  /api/tests/:id/progress         — mark test in progress
PATCH  /api/tests/:id/complete         — upload result
GET    /api/patients/:id/tests         — test history
```

### Pharmacy endpoints
```
GET    /api/pharmacy/queue             — prescription queue
PATCH  /api/pharmacy/:rxId/dispense    — mark dispensed
GET    /api/pharmacy/stock             — stock levels
PATCH  /api/pharmacy/stock/:id         — update stock
GET    /api/pharmacy/stock/low         — items below threshold
POST   /api/pharmacy/returns           — log return or wastage
```

### Patient app endpoints
```
POST   /api/patient/register           — register with ID + OTP
GET    /api/patient/prescriptions/active — current prescription
GET    /api/patient/alerts/today       — today's dose schedule
PATCH  /api/patient/alerts/:id/taken  — confirm dose taken
GET    /api/patient/history            — full medication history
```

### Transfer endpoints
```
POST   /api/patients/:id/transfer      — initiate transfer
PATCH  /api/transfers/:id/accept       — receiving doctor accepts
PATCH  /api/transfers/:id/decline      — receiving doctor declines
PATCH  /api/transfers/:id/approve      — admin approves external
PATCH  /api/transfers/:id/complete     — mark complete
POST   /api/transfers/:id/summary      — generate discharge summary PDF
GET    /api/patients/:id/transfers     — transfer history
```

---

## Security rules

1. Every API endpoint checks JWT + role in middleware before running
2. Doctor endpoints: also check that the patient is assigned to this doctor
3. Nurse endpoints: also check that the patient is in this nurse's ward
4. All data at rest is encrypted
5. TLS 1.2+ required on all connections
6. Every write action is logged in `audit_log` (user_id, action, entity, old_value, new_value, timestamp)
7. FIR numbers are write-once — reject any update attempt
8. Prescription records cannot be deleted, only archived
9. Payment webhook must verify Razorpay signature before processing
10. Unique constraint on alerts (prescription_line_id, scheduled_date, slot_time)

---

## Key database tables summary

```
patients              — core patient record (Module 1)
prescriptions         — prescription header, versioned (Module 3)
prescription_lines    — one row per medicine (Module 3)
test_orders           — diagnostic test orders and results (Module 3)
alerts                — scheduled dose alerts (Module 5)
medication_log        — dose administration records (Module 4)
vitals                — patient vitals per ward round (Module 4)
patient_transfers     — transfer records (Module 9)
pharmacy_dispenses    — what was dispensed and when (Module 6)
stock_items           — medicine stock with batch + expiry (Module 6)
billing_entries       — auto-generated billing per dispense (Module 6)
audit_log             — every write action in the system
users                 — all users, all roles
departments           — hospital departments
doctors               — doctor profiles
doctor_roster         — which doctors are on duty which days
specialty_mapping     — complaint keywords → specialty (auto-assign)
department_specialty  — specialty → department (auto-assign)
test_catalogue        — available tests, departments, TAT
medicine_formulary    — approved medicines list
department_fees       — consultation fee per department
vitals_config         — normal ranges per vital, configurable by Admin
```

---

## Start here — recommended build order

1. Database schema (all tables above)
2. Auth system (JWT, roles, middleware)
3. Patient registration + profile state machine
4. Auto-assignment engine
5. Payment integration (Razorpay + webhook)
6. Doctor module (notes, test orders, prescriptions)
7. Lab module (queue, result upload, doctor alert)
8. Alert engine (background service)
9. Nurse module (alert dashboard, dose logging, vitals)
10. Pharmacy module (queue, dispense, stock)
11. Patient transfer feature
12. Patient mobile app
13. Admin dashboard + reports

---

*Document version 1.0 — 2026*
*This file is the single source of truth for the HMS build. Any changes to workflows, fields, or rules must be updated here first.*
