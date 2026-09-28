"""Seeds reference/config data + demo users per role + a showcase set of demo patients
(with notes, prescriptions, lab orders, vitals, dispensing and billing) so the app looks
like a live hospital the moment you log in — good for demos, not just empty tables.

Run from backend/: python seed.py   (or `docker-compose run --rm backend python seed.py`)

Idempotent: safe to re-run — every insert is guarded by a "does it already exist" check.
Demo patients are only created (with their full set of related records) the first time;
on re-run, existing ones are left untouched rather than duplicating their history.
"""

import datetime as dt
import random
import uuid

from sqlalchemy import select

from app.core.roles import Role
from app.core.security import hash_password
from app.db import all_models  # noqa: F401 — populates metadata / relationships
from app.db.session import SessionLocal
from app.modules.admin.models import (
    AlertWindowConfig,
    Department,
    DepartmentFee,
    DepartmentSpecialty,
    MedicineFormulary,
    SalaryStatus,
    SpecialtyMapping,
    StaffSalary,
    TestCatalogue,
    VitalsConfig,
)
from app.modules.alerts.models import Alert, AlertStatus, RouteTo
from app.modules.auth.models import User
from app.modules.doctors.models import (
    Doctor,
    DoctorRoster,
    ExaminationNote,
    FREQUENCY_SLOTS,
    Frequency,
    Prescription,
    PrescriptionLine,
    Route,
)
from app.modules.labs.models import LabPaymentStatus, TestOrder, TestOrderStatus
from app.modules.nurses.models import Vitals
from app.modules.patients.models import (
    AdmissionType,
    Gender,
    IntakeChannel,
    Patient,
    PaymentMethod,
    PaymentStatus,
    ProfileStatus,
)
from app.modules.pharmacy.models import (
    BillingEntry,
    BillingPaymentStatus,
    DispenseLog,
    DispenseStatus,
    PharmacyPrescription,
    StockItem,
)

DEPARTMENTS = [
    ("General Medicine", "GEN"),
    ("Cardiology", "CARD"),
    ("Orthopedics", "ORTHO"),
    ("Neurology", "NEURO"),
    ("Pediatrics", "PEDS"),
    ("Radiology", "RAD"),
    ("Pathology", "PATH"),
    ("Emergency", "ER"),
    ("ICU", "ICU"),
    ("Surgery", "SURG"),
]

DEPARTMENT_FEES = {
    "General Medicine": 500,
    "Cardiology": 1200,
    "Orthopedics": 900,
    "Neurology": 1100,
    "Pediatrics": 600,
    "Radiology": 800,
    "Pathology": 400,
    "Emergency": 1500,
    "ICU": 2000,
    "Surgery": 2500,
}

SPECIALTY_MAPPING = [
    ("chest pain", "Cardiology"),
    ("heart", "Cardiology"),
    ("palpitations", "Cardiology"),
    ("fracture", "Orthopedics"),
    ("bone", "Orthopedics"),
    ("joint pain", "Orthopedics"),
    ("headache", "Neurology"),
    ("migraine", "Neurology"),
    ("seizure", "Neurology"),
    ("fever", "General Medicine"),
    ("cold", "General Medicine"),
    ("cough", "General Medicine"),
    ("stomach pain", "General Medicine"),
    ("accident", "Emergency"),
    ("trauma", "Emergency"),
    ("child", "Pediatrics"),
    ("infant", "Pediatrics"),
]

# specialty -> department name (second hop of auto-assignment)
DEPARTMENT_SPECIALTY = {
    "Cardiology": "Cardiology",
    "Orthopedics": "Orthopedics",
    "Neurology": "Neurology",
    "General Medicine": "General Medicine",
    "Emergency": "Emergency",
    "Pediatrics": "Pediatrics",
}

TEST_CATALOGUE = [
    # name, category, department, tat_min_hours, tat_max_hours, price
    ("Blood Test (CBC)", "Pathology", "Pathology", 2, 6, 300),
    ("LFT", "Pathology", "Pathology", 2, 6, 450),
    ("RFT", "Pathology", "Pathology", 2, 6, 450),
    ("MRI", "Radiology", "Radiology", 4, 24, 4500),
    ("CT Scan", "Radiology", "Radiology", 2, 4, 3000),
    ("X-Ray", "Radiology", "Radiology", 1, 2, 400),
    ("Ultrasound", "Radiology", "Radiology", 1, 3, 800),
    ("ECG", "Cardiology", "Cardiology", 0.5, 0.5, 250),
    ("Urine Analysis", "Pathology", "Pathology", 2, 4, 200),
    ("Stool Analysis", "Pathology", "Pathology", 2, 4, 200),
]

MEDICINE_FORMULARY = [
    ("Paracetamol", "500mg"),
    ("Azithromycin", "250mg"),
    ("Cetirizine", "10mg"),
    ("Amoxicillin", "500mg"),
    ("Metformin", "500mg"),
    ("Amlodipine", "5mg"),
    ("Ibuprofen", "400mg"),
    ("Omeprazole", "20mg"),
]

VITALS_CONFIG = [
    ("temperature_c", 36.1, 37.2),
    ("bp_systolic", 90, 120),
    ("bp_diastolic", 60, 80),
    ("pulse_bpm", 60, 100),
    ("spo2_pct", 95, 100),
    ("resp_rate", 12, 20),
    ("blood_glucose", 70, 140),
]

# ---------------------------------------------------------------------------
# Extra staff, beyond the one-per-role minimum, so role lists / staff salaries
# / doctor stats aren't all single-row tables during a demo.
# ---------------------------------------------------------------------------

DOCTORS = [
    # email, full_name, phone, specialty (== department name)
    ("doctor.verma@cityhospital.com", "Dr. Amit Verma", "9000000006", "Cardiology"),
    ("doctor.joshi@cityhospital.com", "Dr. Neha Joshi", "9000000007", "Neurology"),
    ("doctor.singh@cityhospital.com", "Dr. Rajesh Singh", "9000000008", "Orthopedics"),
    ("doctor.rao@cityhospital.com", "Dr. Kavita Rao", "9000000009", "Pediatrics"),
    ("doctor.gupta@cityhospital.com", "Dr. Sanjay Gupta", "9000000010", "General Medicine"),
    ("doctor.khan@cityhospital.com", "Dr. Ayesha Khan", "9000000011", "Emergency"),
]

EXTRA_STAFF = [
    # email, full_name, phone, role, ward (only for head_nurse)
    ("reception2@cityhospital.com", "Kavita Reddy", "9000000012", Role.receptionist, None),
    ("nurse.icu@cityhospital.com", "Meena Iyer", "9000000013", Role.head_nurse, "ICU"),
    ("lab2@cityhospital.com", "Ramesh Nair", "9000000014", Role.lab_staff, None),
    ("pharmacy2@cityhospital.com", "Anjali Mehta", "9000000015", Role.pharmacist, None),
]

ROLE_PASSWORD = {
    Role.receptionist: "Reception@123",
    Role.head_nurse: "Nurse@123",
    Role.lab_staff: "Lab@123",
    Role.pharmacist: "Pharmacy@123",
    Role.doctor: "Doctor@123",
}

# ---------------------------------------------------------------------------
# Demo patients — a realistic spread across departments, admission types and
# payment states, each with a note, a prescription, lab orders, vitals (if
# admitted) and a pharmacy dispense + bill, so every role's screens have
# something to show.
# ---------------------------------------------------------------------------

DEMO_PATIENTS = [
    {
        "id_number": "DEMO-AADHAAR-2001",
        "full_name": "Sunita Devi",
        "dob": dt.date(1975, 6, 10),
        "gender": Gender.F,
        "blood_group": "O+",
        "mobile": "9876500001",
        "mobile_verified": True,
        "email": "sunita.devi@example.com",
        "address": "12, Model Town, Delhi - 110009",
        "emergency_name": "Rakesh Devi",
        "emergency_phone": "9876500011",
        "intake_channel": IntakeChannel.emergency,
        "admission_type": AdmissionType.inpatient,
        "ward": "General Ward",
        "doctor_specialty": "Cardiology",
        "chief_complaint": "Chest pain and palpitations",
        "payment_status": PaymentStatus.paid,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 6,
        "tests": [("ECG", TestOrderStatus.reviewed, LabPaymentStatus.paid), ("Blood Test (CBC)", TestOrderStatus.completed, LabPaymentStatus.paid)],
        "meds": [
            ("Amlodipine", "5mg", Route.oral, Frequency.once_daily, 14, True, "Take after breakfast"),
            ("Paracetamol", "500mg", Route.oral, Frequency.thrice_daily, 5, False, None),
        ],
        "alert_slot": True,
    },
    {
        "id_number": "DEMO-AADHAAR-2002",
        "full_name": "Mohan Lal",
        "dob": dt.date(1990, 1, 22),
        "gender": Gender.M,
        "blood_group": "B+",
        "mobile": "9876500002",
        "mobile_verified": True,
        "email": "mohan.lal@example.com",
        "address": "45, Lajpat Nagar, Delhi - 110024",
        "emergency_name": "Geeta Lal",
        "emergency_phone": "9876500012",
        "intake_channel": IntakeChannel.phone,
        "admission_type": AdmissionType.outpatient,
        "ward": None,
        "doctor_specialty": "Neurology",
        "chief_complaint": "Recurring migraine",
        "payment_status": PaymentStatus.paid,
        "profile_status": ProfileStatus.discharged,
        "admitted_days_ago": 2,
        "discharged_days_ago": 1,
        "tests": [("MRI", TestOrderStatus.reviewed, LabPaymentStatus.paid)],
        "meds": [("Ibuprofen", "400mg", Route.oral, Frequency.as_needed, 10, True, "Only if pain > 6/10")],
    },
    {
        "id_number": "DEMO-AADHAAR-2003",
        "full_name": "Priya Nair",
        "dob": dt.date(2001, 9, 5),
        "gender": Gender.F,
        "blood_group": "A+",
        "mobile": "9876500003",
        "mobile_verified": False,
        "email": "priya.nair@example.com",
        "address": "8, Koramangala, Bengaluru - 560034",
        "emergency_name": "Suresh Nair",
        "emergency_phone": "9876500013",
        "intake_channel": IntakeChannel.website,
        "admission_type": AdmissionType.day_care,
        "ward": None,
        "doctor_specialty": "Orthopedics",
        "chief_complaint": "Joint pain in left knee",
        "payment_status": PaymentStatus.paid,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 0,
        "tests": [("X-Ray", TestOrderStatus.pending, LabPaymentStatus.pending)],
        "meds": [("Ibuprofen", "400mg", Route.oral, Frequency.twice_daily, 7, True, None)],
    },
    {
        "id_number": "DEMO-AADHAAR-2004",
        "full_name": "Arjun Mehta",
        "dob": dt.date(1985, 3, 15),
        "gender": Gender.M,
        "blood_group": "AB+",
        "mobile": "9876500004",
        "mobile_verified": True,
        "email": "arjun.mehta@example.com",
        "address": "21, Andheri West, Mumbai - 400058",
        "emergency_name": "Neha Mehta",
        "emergency_phone": "9876500014",
        "intake_channel": IntakeChannel.emergency,
        "admission_type": AdmissionType.inpatient,
        "ward": "ICU",
        "doctor_specialty": "Emergency",
        "chief_complaint": "Road traffic accident trauma",
        "payment_status": PaymentStatus.deferred,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 1,
        "medico_legal": True,
        "fir_number": "FIR-2026-0451",
        "tests": [("CT Scan", TestOrderStatus.completed, LabPaymentStatus.pending), ("Blood Test (CBC)", TestOrderStatus.in_progress, LabPaymentStatus.pending)],
        "meds": [("Paracetamol", "500mg", Route.IV, Frequency.every_8h, 3, False, "Monitor BP before each dose")],
        "alert_slot": True,
    },
    {
        "id_number": "DEMO-AADHAAR-2005",
        "full_name": "Baby Ananya",
        "dob": dt.date(2023, 11, 2),
        "gender": Gender.F,
        "blood_group": "O-",
        "mobile": "9876500005",
        "mobile_verified": True,
        "email": None,
        "address": "3, Salt Lake, Kolkata - 700064",
        "emergency_name": "Ritu Sen",
        "emergency_phone": "9876500015",
        "intake_channel": IntakeChannel.emergency,
        "admission_type": AdmissionType.inpatient,
        "ward": "Pediatric Ward",
        "doctor_specialty": "Pediatrics",
        "chief_complaint": "High fever and persistent cough",
        "payment_status": PaymentStatus.paid,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 3,
        "tests": [("Blood Test (CBC)", TestOrderStatus.reviewed, LabPaymentStatus.paid)],
        "meds": [("Azithromycin", "250mg", Route.oral, Frequency.once_daily, 3, True, "Pediatric dose — syrup form")],
    },
    {
        "id_number": "DEMO-AADHAAR-2006",
        "full_name": "Ramesh Yadav",
        "dob": dt.date(1968, 12, 1),
        "gender": Gender.M,
        "blood_group": "B-",
        "mobile": "9876500006",
        "mobile_verified": True,
        "email": "ramesh.yadav@example.com",
        "address": "67, Civil Lines, Kanpur - 208001",
        "emergency_name": "Kamla Yadav",
        "emergency_phone": "9876500016",
        "intake_channel": IntakeChannel.phone,
        "admission_type": AdmissionType.inpatient,
        "ward": "General Ward",
        "doctor_specialty": "General Medicine",
        "chief_complaint": "Fever and body pain",
        "payment_status": PaymentStatus.paid,
        "profile_status": ProfileStatus.discharged,
        "admitted_days_ago": 5,
        "discharged_days_ago": 2,
        "tests": [("Urine Analysis", TestOrderStatus.reviewed, LabPaymentStatus.paid)],
        "meds": [("Paracetamol", "500mg", Route.oral, Frequency.thrice_daily, 5, False, None)],
    },
    {
        "id_number": "DEMO-AADHAAR-2007",
        "full_name": "Deepa Kulkarni",
        "dob": dt.date(1992, 7, 19),
        "gender": Gender.F,
        "blood_group": "A-",
        "mobile": "9876500007",
        "mobile_verified": True,
        "email": "deepa.kulkarni@example.com",
        "address": "14, Kothrud, Pune - 411038",
        "emergency_name": "Anil Kulkarni",
        "emergency_phone": "9876500017",
        "intake_channel": IntakeChannel.website,
        "admission_type": AdmissionType.outpatient,
        "ward": None,
        "doctor_specialty": "Cardiology",
        "chief_complaint": "Occasional chest discomfort",
        "payment_status": PaymentStatus.paid,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 0,
        "tests": [("ECG", TestOrderStatus.completed, LabPaymentStatus.paid)],
        "meds": [("Amlodipine", "5mg", Route.oral, Frequency.once_daily, 30, True, None)],
    },
    {
        "id_number": "DEMO-AADHAAR-2008",
        "full_name": "Vikram Chauhan",
        "dob": dt.date(1979, 4, 25),
        "gender": Gender.M,
        "blood_group": "O+",
        "mobile": "9876500008",
        "mobile_verified": False,
        "email": "vikram.chauhan@example.com",
        "address": "29, Sector 15, Chandigarh - 160015",
        "emergency_name": "Simran Chauhan",
        "emergency_phone": "9876500018",
        "intake_channel": IntakeChannel.phone,
        "admission_type": AdmissionType.day_care,
        "ward": None,
        "doctor_specialty": "Orthopedics",
        "chief_complaint": "Fracture in left arm",
        "payment_status": PaymentStatus.waived,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 4,
        "tests": [("X-Ray", TestOrderStatus.reviewed, LabPaymentStatus.waived)],
        "meds": [("Ibuprofen", "400mg", Route.oral, Frequency.twice_daily, 10, True, None)],
    },
    {
        "id_number": "DEMO-AADHAAR-2009",
        "full_name": "Farah Sheikh",
        "dob": dt.date(1988, 8, 30),
        "gender": Gender.F,
        "blood_group": "B+",
        "mobile": "9876500009",
        "mobile_verified": True,
        "email": "farah.sheikh@example.com",
        "address": "51, Banjara Hills, Hyderabad - 500034",
        "emergency_name": "Imran Sheikh",
        "emergency_phone": "9876500019",
        "intake_channel": IntakeChannel.website,
        "admission_type": AdmissionType.outpatient,
        "ward": None,
        "doctor_specialty": "General Medicine",
        "chief_complaint": "Common cold and cough",
        "payment_status": PaymentStatus.pending,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 0,
        "tests": [],
        "meds": [("Cetirizine", "10mg", Route.oral, Frequency.once_daily, 5, False, None)],
    },
    {
        "id_number": "DEMO-AADHAAR-2010",
        "full_name": "Rohit Malhotra",
        "dob": dt.date(1995, 5, 5),
        "gender": Gender.M,
        "blood_group": "AB-",
        "mobile": "9876500010",
        "mobile_verified": True,
        "email": "rohit.malhotra@example.com",
        "address": "5, Vasant Kunj, Delhi - 110070",
        "emergency_name": "Anita Malhotra",
        "emergency_phone": "9876500020",
        "intake_channel": IntakeChannel.emergency,
        "admission_type": AdmissionType.inpatient,
        "ward": "ICU",
        "doctor_specialty": "Neurology",
        "chief_complaint": "Seizure episode",
        "payment_status": PaymentStatus.paid,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 2,
        "tests": [("CT Scan", TestOrderStatus.reviewed, LabPaymentStatus.paid)],
        "meds": [("Paracetamol", "500mg", Route.IV, Frequency.every_6h, 2, False, None)],
    },
    {
        "id_number": "DEMO-AADHAAR-2011",
        "full_name": "Kiran Bedi",
        "dob": dt.date(1983, 10, 14),
        "gender": Gender.F,
        "blood_group": "A+",
        "mobile": "9876500021",
        "mobile_verified": True,
        "email": "kiran.bedi@example.com",
        "address": "9, Malviya Nagar, Jaipur - 302017",
        "emergency_name": "Vijay Bedi",
        "emergency_phone": "9876500022",
        "intake_channel": IntakeChannel.phone,
        "admission_type": AdmissionType.outpatient,
        "ward": None,
        "doctor_specialty": "General Medicine",
        "chief_complaint": "Stomach pain",
        "payment_status": PaymentStatus.paid,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 1,
        "tests": [("Stool Analysis", TestOrderStatus.completed, LabPaymentStatus.paid)],
        "meds": [("Omeprazole", "20mg", Route.oral, Frequency.once_daily, 14, True, "Take before breakfast")],
    },
    {
        "id_number": "DEMO-AADHAAR-2012",
        "full_name": "Sameer Joshi",
        "dob": dt.date(1970, 2, 18),
        "gender": Gender.M,
        "blood_group": "O-",
        "mobile": "9876500023",
        "mobile_verified": True,
        "email": "sameer.joshi@example.com",
        "address": "17, Shivaji Nagar, Nagpur - 440010",
        "emergency_name": "Meera Joshi",
        "emergency_phone": "9876500024",
        "intake_channel": IntakeChannel.emergency,
        "admission_type": AdmissionType.inpatient,
        "ward": "General Ward",
        "doctor_specialty": "Emergency",
        "chief_complaint": "Trauma from a fall",
        "payment_status": PaymentStatus.deferred,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 0,
        "tests": [("X-Ray", TestOrderStatus.pending, LabPaymentStatus.pending)],
        "meds": [("Paracetamol", "500mg", Route.oral, Frequency.thrice_daily, 4, False, None)],
    },
    {
        "id_number": "DEMO-AADHAAR-2013",
        "full_name": "Anita Desai",
        "dob": dt.date(1980, 4, 11),
        "gender": Gender.F,
        "blood_group": "A+",
        "mobile": "9876500025",
        "mobile_verified": True,
        "email": "anita.desai@example.com",
        "address": "22, Bandra West, Mumbai - 400050",
        "emergency_name": "Rohan Desai",
        "emergency_phone": "9876500026",
        "intake_channel": IntakeChannel.website,
        "admission_type": AdmissionType.outpatient,
        "ward": None,
        "doctor_specialty": "Cardiology",
        "chief_complaint": "Palpitations and dizziness",
        "payment_status": PaymentStatus.paid,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 0,
        "tests": [("ECG", TestOrderStatus.pending, LabPaymentStatus.paid)],
        "meds": [("Amlodipine", "5mg", Route.oral, Frequency.once_daily, 14, True, None)],
    },
    {
        "id_number": "DEMO-AADHAAR-2014",
        "full_name": "Rahul Verma",
        "dob": dt.date(1991, 8, 23),
        "gender": Gender.M,
        "blood_group": "B+",
        "mobile": "9876500027",
        "mobile_verified": True,
        "email": "rahul.verma@example.com",
        "address": "10, Sector 21, Noida - 201301",
        "emergency_name": "Suman Verma",
        "emergency_phone": "9876500028",
        "intake_channel": IntakeChannel.emergency,
        "admission_type": AdmissionType.inpatient,
        "ward": "ICU",
        "doctor_specialty": "Emergency",
        "chief_complaint": "Severe abdominal pain after a fall",
        "payment_status": PaymentStatus.pending,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 0,
        "tests": [("CT Scan", TestOrderStatus.in_progress, LabPaymentStatus.pending)],
        "meds": [("Paracetamol", "500mg", Route.IV, Frequency.every_8h, 2, False, "Monitor closely")],
    },
    {
        "id_number": "DEMO-AADHAAR-2015",
        "full_name": "Pooja Iyer",
        "dob": dt.date(1997, 12, 2),
        "gender": Gender.F,
        "blood_group": "O+",
        "mobile": "9876500029",
        "mobile_verified": True,
        "email": "pooja.iyer@example.com",
        "address": "6, T Nagar, Chennai - 600017",
        "emergency_name": "Ganesh Iyer",
        "emergency_phone": "9876500030",
        "intake_channel": IntakeChannel.phone,
        "admission_type": AdmissionType.outpatient,
        "ward": None,
        "doctor_specialty": "General Medicine",
        "chief_complaint": "High fever since yesterday",
        "payment_status": PaymentStatus.pending,
        "profile_status": ProfileStatus.active,
        "admitted_days_ago": 0,
        "tests": [("Blood Test (CBC)", TestOrderStatus.pending, LabPaymentStatus.pending)],
        "meds": [("Paracetamol", "500mg", Route.oral, Frequency.thrice_daily, 3, False, None)],
    },
]


def get_or_create(db, model, defaults=None, **lookup):
    existing = db.execute(select(model).filter_by(**lookup)).scalar_one_or_none()
    if existing:
        return existing, False
    obj = model(**lookup, **(defaults or {}))
    db.add(obj)
    db.flush()
    return obj, True


def seed():
    db = SessionLocal()
    try:
        # ---- Departments ---------------------------------------------------
        dept_by_name: dict[str, Department] = {}
        for name, code in DEPARTMENTS:
            dept, _ = get_or_create(db, Department, name=name, defaults={"code": code})
            dept_by_name[name] = dept
        db.commit()

        for name, fee in DEPARTMENT_FEES.items():
            get_or_create(
                db, DepartmentFee, department_id=dept_by_name[name].id, defaults={"consult_fee": fee}
            )
        db.commit()

        for keyword, specialty in SPECIALTY_MAPPING:
            get_or_create(db, SpecialtyMapping, keyword=keyword, defaults={"specialty": specialty})
        db.commit()

        for specialty, dept_name in DEPARTMENT_SPECIALTY.items():
            get_or_create(
                db, DepartmentSpecialty, specialty=specialty, defaults={"department_id": dept_by_name[dept_name].id}
            )
        db.commit()

        test_catalogue_by_name: dict[str, TestCatalogue] = {}
        for name, category, dept_name, tat_min, tat_max, price in TEST_CATALOGUE:
            test, _ = get_or_create(
                db,
                TestCatalogue,
                name=name,
                defaults={
                    "category": category,
                    "department_id": dept_by_name[dept_name].id,
                    "tat_min_hours": tat_min,
                    "tat_max_hours": tat_max,
                    "price": price,
                },
            )
            test_catalogue_by_name[name] = test
        db.commit()

        for name, dosage in MEDICINE_FORMULARY:
            get_or_create(db, MedicineFormulary, name=name, defaults={"default_dosage": dosage, "is_approved": True})
        db.commit()

        for vital_name, lo, hi in VITALS_CONFIG:
            get_or_create(db, VitalsConfig, vital_name=vital_name, defaults={"min_value": lo, "max_value": hi})
        db.commit()

        if db.execute(select(AlertWindowConfig)).scalars().first() is None:
            db.add(AlertWindowConfig(fire_before_minutes=15, expire_after_minutes=30))
            db.commit()

        # ---- Stock items (pharmacy) -----------------------------------------
        stock_by_name: dict[str, StockItem] = {}
        expiry = dt.date.today() + dt.timedelta(days=365)
        for name, _dosage in MEDICINE_FORMULARY:
            stock, _ = get_or_create(
                db,
                StockItem,
                medicine_name=name,
                batch_number="SEED-BATCH-1",
                defaults={
                    "expiry_date": expiry,
                    "quantity": 500,
                    "min_threshold": 50,
                    "unit_price": 5.0,
                },
            )
            stock_by_name[name] = stock
        db.commit()

        # A couple of realistically low-stock items so the admin dashboard's low-stock
        # widget has something to show instead of an all-green demo that proves nothing.
        for name, low_qty in (("Cetirizine", 28), ("Omeprazole", 12)):
            stock_by_name[name].quantity = low_qty
        db.commit()

        # ---- Demo users -------------------------------------------------------
        admin_user, _ = get_or_create(
            db,
            User,
            email="admin@cityhospital.com",
            defaults={
                "password_hash": hash_password("Admin@123"),
                # Chief Medical Officer persona — the account is admin-rooted but stands
                # in for a doctor-administrator, so the homepage greeting ("Dr. ...")
                # and doctor-facing framing throughout the demo reads naturally.
                "full_name": "Dr. Meera Kapoor",
                "phone": "9000000001",
                "role": Role.admin,
            },
        )

        reception_user, _ = get_or_create(
            db,
            User,
            email="reception@cityhospital.com",
            defaults={
                "password_hash": hash_password("Reception@123"),
                "full_name": "Sunita Sharma",
                "phone": "9000000002",
                "role": Role.receptionist,
            },
        )

        nurse_user, _ = get_or_create(
            db,
            User,
            email="nurse@cityhospital.com",
            defaults={
                "password_hash": hash_password("Nurse@123"),
                "full_name": "Nurse Pooja",
                "phone": "9000000003",
                "role": Role.head_nurse,
                "ward": "General Ward",
            },
        )

        lab_user, _ = get_or_create(
            db,
            User,
            email="lab@cityhospital.com",
            defaults={
                "password_hash": hash_password("Lab@123"),
                "full_name": "Lab Staff",
                "phone": "9000000004",
                "role": Role.lab_staff,
            },
        )

        pharmacy_user, _ = get_or_create(
            db,
            User,
            email="pharmacy@cityhospital.com",
            defaults={
                "password_hash": hash_password("Pharmacy@123"),
                "full_name": "Pharmacist",
                "phone": "9000000005",
                "role": Role.pharmacist,
            },
        )
        db.commit()

        # ---- Extra staff (variety for lists / staff salaries) -----------------
        nurse_by_ward: dict[str, User] = {"General Ward": nurse_user}
        for email, full_name, phone, role, ward in EXTRA_STAFF:
            defaults = {
                "password_hash": hash_password(ROLE_PASSWORD[role]),
                "full_name": full_name,
                "phone": phone,
                "role": role,
            }
            if ward:
                defaults["ward"] = ward
            user, _ = get_or_create(db, User, email=email, defaults=defaults)
            if role == Role.head_nurse and ward:
                nurse_by_ward[ward] = user
        db.commit()

        # ---- Doctors ------------------------------------------------------
        doctor_by_specialty: dict[str, Doctor] = {}
        for email, full_name, phone, specialty in DOCTORS:
            doc_user, _ = get_or_create(
                db,
                User,
                email=email,
                defaults={
                    "password_hash": hash_password("Doctor@123"),
                    "full_name": full_name,
                    "phone": phone,
                    "role": Role.doctor,
                },
            )
            db.commit()
            doctor, _ = get_or_create(
                db,
                Doctor,
                user_id=doc_user.id,
                defaults={"department_id": dept_by_name[specialty].id, "specialty": specialty, "is_active": True},
            )
            db.commit()
            doctor_by_specialty[specialty] = doctor

            # On duty every day of the week, so auto-assignment always finds them
            # regardless of what day the demo is run on.
            for day in range(7):
                get_or_create(
                    db,
                    DoctorRoster,
                    doctor_id=doctor.id,
                    day_of_week=day,
                    defaults={"is_on_duty": True, "max_patients": 20},
                )
        db.commit()

        # Kept for backwards compatibility with anything referencing these names.
        doctor = doctor_by_specialty["Cardiology"]
        doctor2 = doctor_by_specialty["Neurology"]

        # ---- Demo patients, with notes / prescriptions / labs / vitals / bills --
        now = dt.datetime.now(dt.timezone.utc)
        lab_receipt_seq = 0
        pharmacy_receipt_seq = 0

        for idx, spec in enumerate(DEMO_PATIENTS, start=1):
            existing_patient = db.execute(
                select(Patient).filter_by(id_number=spec["id_number"])
            ).scalar_one_or_none()

            attending = doctor_by_specialty[spec["doctor_specialty"]]
            admitted_at = now - dt.timedelta(days=spec["admitted_days_ago"], hours=2)
            discharged_at = None
            if spec.get("discharged_days_ago") is not None:
                discharged_at = now - dt.timedelta(days=spec["discharged_days_ago"])

            if existing_patient is not None:
                # Demo patients are only created once, but their "admitted N days ago"
                # story would otherwise freeze at whatever calendar day they were first
                # seeded — a week later, "admitted today" patients silently stop showing
                # up in any today-scoped view (Homepage's Admitted Today, the Emergency
                # Cases recency window, etc.). Re-running seed.py refreshes every demo
                # patient's dates back to "as of right now" so the demo never goes stale.
                patient = existing_patient
                patient.admitted_at = admitted_at
                patient.discharged_at = discharged_at
                # Registration time tracks admission for these walk-in/emergency demo
                # patients — keeps reception's "New Patients Today" stat alive too.
                patient.created_at = admitted_at

                note = db.execute(
                    select(ExaminationNote).filter_by(patient_id=patient.id)
                ).scalars().first()
                if note is not None:
                    note.created_at = admitted_at + dt.timedelta(minutes=30)

                prescription = db.execute(
                    select(Prescription).filter_by(patient_id=patient.id).order_by(Prescription.version.desc())
                ).scalars().first()
                if prescription is not None:
                    prescription.created_at = admitted_at + dt.timedelta(minutes=45)
                    for line in db.execute(
                        select(PrescriptionLine).filter_by(prescription_id=prescription.id)
                    ).scalars():
                        line.start_date = admitted_at.date()

                existing_tests = {
                    t.test_type_id: t
                    for t in db.execute(select(TestOrder).filter_by(patient_id=patient.id)).scalars()
                }
                for test_name, status, pay_status in spec["tests"]:
                    test = test_catalogue_by_name[test_name]
                    order = existing_tests.get(test.id)
                    if order is None:
                        continue
                    ordered_at = admitted_at + dt.timedelta(hours=1)
                    completed_at = (
                        ordered_at + dt.timedelta(hours=2)
                        if status in (TestOrderStatus.completed, TestOrderStatus.reviewed)
                        else None
                    )
                    reviewed_at = completed_at + dt.timedelta(hours=1) if status == TestOrderStatus.reviewed else None
                    order.ordered_at = ordered_at
                    order.completed_at = completed_at
                    order.reviewed_at = reviewed_at
                    order.paid_at = now if pay_status == LabPaymentStatus.paid else None

                pharmacy_rx = db.execute(
                    select(PharmacyPrescription).filter_by(patient_id=patient.id)
                ).scalars().first()
                if pharmacy_rx is not None:
                    dispensed_at = admitted_at + dt.timedelta(hours=1, minutes=30)
                    logs = db.execute(
                        select(DispenseLog).filter_by(pharmacy_prescription_id=pharmacy_rx.id)
                    ).scalars().all()
                    for log in logs:
                        log.dispensed_at = dispensed_at
                    if logs:
                        bill = db.execute(
                            select(BillingEntry).filter_by(dispense_log_id=logs[-1].id)
                        ).scalars().first()
                        if bill is not None and bill.payment_status != BillingPaymentStatus.pending:
                            bill.paid_at = now

                # Vitals are regenerated (not shifted) — some patients picked up extra
                # one-off rows over time (e.g. a hand-added flagged reading) whose
                # timestamps weren't proportionally anchored to the original admission
                # window, so shifting them by a re-run's delta drifted them into the
                # future. A clean regenerate is self-correcting on every re-run instead.
                if spec["admission_type"] == AdmissionType.inpatient and spec["ward"]:
                    recorder = nurse_by_ward.get(spec["ward"], nurse_user)
                    for v in db.execute(select(Vitals).filter_by(patient_id=patient.id)).scalars():
                        db.delete(v)
                    db.flush()
                    span_seconds = (now - admitted_at).total_seconds()
                    n_points = 5
                    for i in range(n_points):
                        frac = (i + 1) / (n_points + 1)
                        recorded_at = admitted_at + dt.timedelta(seconds=max(span_seconds, 0) * frac)
                        db.add(Vitals(
                            patient_id=patient.id, recorded_by=recorder.id, recorded_at=recorded_at,
                            temperature_c=round(random.uniform(36.7, 38.3), 1),
                            bp_systolic=random.randint(108, 138), bp_diastolic=random.randint(68, 90),
                            pulse_bpm=random.randint(66, 108), spo2_pct=random.randint(93, 99),
                            resp_rate=random.randint(14, 22), blood_glucose=round(random.uniform(85, 145), 1),
                            flagged=False,
                        ))
                    # Showcase one clearly abnormal, flagged reading on the trauma/ICU
                    # patient so the ICU Key Sheet has something to actually flag.
                    if spec["id_number"] == "DEMO-AADHAAR-2004":
                        db.add(Vitals(
                            patient_id=patient.id, recorded_by=recorder.id,
                            recorded_at=now - dt.timedelta(minutes=8),
                            temperature_c=38.9, bp_systolic=88, bp_diastolic=56,
                            pulse_bpm=132, spo2_pct=89, resp_rate=27, blood_glucose=142,
                            flagged=True,
                        ))

                # Alerts are recomputed the same way, for the same reason.
                if spec.get("alert_slot"):
                    for a in db.execute(select(Alert).filter_by(patient_id=patient.id)).scalars():
                        db.delete(a)
                    db.flush()
                    if prescription is not None:
                        first_line = db.execute(
                            select(PrescriptionLine).filter_by(prescription_id=prescription.id)
                        ).scalars().first()
                        if first_line is not None and spec["ward"] in nurse_by_ward:
                            slots = FREQUENCY_SLOTS.get(first_line.frequency, [])
                            slot_str = slots[0] if slots else "08:00"
                            hour, minute = (int(part) for part in slot_str.split(":"))
                            slot_time = dt.time(hour, minute)
                            fire_at = now - dt.timedelta(minutes=10)
                            db.add(Alert(
                                patient_id=patient.id,
                                prescription_line_id=first_line.id,
                                scheduled_date=now.date(),
                                slot_time=slot_time,
                                fire_at=fire_at,
                                expire_at=fire_at + dt.timedelta(minutes=30),
                                status=AlertStatus.FIRED,
                                route_to=RouteTo.nurse,
                            ))

                db.commit()
                continue  # already seeded — dates refreshed above, history otherwise untouched

            consult_fee = DEPARTMENT_FEES[spec["doctor_specialty"]]
            receipt_number = None
            collected_by = None
            payment_method = None
            if spec["payment_status"] == PaymentStatus.paid:
                receipt_number = f"RCPT-{idx:04d}"
                collected_by = reception_user.id
                payment_method = PaymentMethod.offline

            patient = Patient(
                id=uuid.uuid4(),
                full_name=spec["full_name"],
                date_of_birth=spec["dob"],
                gender=spec["gender"],
                id_number=spec["id_number"],
                blood_group=spec["blood_group"],
                mobile=spec["mobile"],
                mobile_verified=spec["mobile_verified"],
                email=spec["email"],
                address=spec["address"],
                emergency_name=spec["emergency_name"],
                emergency_phone=spec["emergency_phone"],
                intake_channel=spec["intake_channel"],
                profile_status=spec["profile_status"],
                admission_type=spec["admission_type"],
                chief_complaint=spec["chief_complaint"],
                medico_legal=spec.get("medico_legal", False),
                fir_number=spec.get("fir_number"),
                department_id=dept_by_name[spec["doctor_specialty"]].id,
                doctor_id=attending.id,
                ward=spec["ward"],
                admitted_at=admitted_at,
                consult_fee=consult_fee,
                payment_method=payment_method,
                payment_status=spec["payment_status"],
                receipt_number=receipt_number,
                collected_by=collected_by,
                discharged_at=discharged_at,
            )
            db.add(patient)
            db.flush()

            # Doctor's examination note
            db.add(
                ExaminationNote(
                    patient_id=patient.id,
                    doctor_id=attending.id,
                    note_text=f"Patient presents with: {spec['chief_complaint']}. Advised treatment as prescribed.",
                    created_at=admitted_at + dt.timedelta(minutes=30),
                )
            )

            # Prescription + lines
            prescription = Prescription(
                patient_id=patient.id,
                doctor_id=attending.id,
                version=1,
                is_active=True,
                notes="Initial prescription on admission/consult.",
                created_at=admitted_at + dt.timedelta(minutes=45),
            )
            db.add(prescription)
            db.flush()

            first_line = None
            for medicine_name, dosage, route, frequency, duration_days, with_food, instructions in spec["meds"]:
                line = PrescriptionLine(
                    prescription_id=prescription.id,
                    medicine_name=medicine_name,
                    dosage=dosage,
                    route=route,
                    frequency=frequency,
                    start_date=admitted_at.date(),
                    duration_days=duration_days,
                    with_food=with_food,
                    special_instructions=instructions,
                )
                db.add(line)
                db.flush()
                if first_line is None:
                    first_line = line

            # Lab test orders
            for test_name, status, pay_status in spec["tests"]:
                lab_receipt_seq += 1
                test = test_catalogue_by_name[test_name]
                ordered_at = admitted_at + dt.timedelta(hours=1)
                completed_at = ordered_at + dt.timedelta(hours=2) if status in (
                    TestOrderStatus.completed,
                    TestOrderStatus.reviewed,
                ) else None
                reviewed_at = completed_at + dt.timedelta(hours=1) if status == TestOrderStatus.reviewed else None
                paid_at = now if pay_status == LabPaymentStatus.paid else None
                db.add(
                    TestOrder(
                        patient_id=patient.id,
                        doctor_id=attending.id,
                        test_type_id=test.id,
                        status=status,
                        ordered_at=ordered_at,
                        result_text="Within normal limits." if completed_at else None,
                        completed_at=completed_at,
                        reviewed_at=reviewed_at,
                        amount=test.price,
                        payment_status=pay_status,
                        paid_at=paid_at,
                        collected_by=lab_user.id if pay_status != LabPaymentStatus.pending else None,
                        receipt_number=f"LAB-{lab_receipt_seq:04d}" if pay_status == LabPaymentStatus.paid else None,
                    )
                )

            # Pharmacy dispensing + billing for the prescription just written
            dispense_status = (
                DispenseStatus.dispensed if spec["payment_status"] != PaymentStatus.pending else DispenseStatus.pending
            )
            pharmacy_rx = PharmacyPrescription(
                prescription_id=prescription.id,
                patient_id=patient.id,
                status=dispense_status,
            )
            db.add(pharmacy_rx)
            db.flush()

            if dispense_status == DispenseStatus.dispensed:
                total_amount = 0.0
                dispensed_at = admitted_at + dt.timedelta(hours=1, minutes=30)
                last_log = None
                for medicine_name, *_rest in spec["meds"]:
                    stock = stock_by_name.get(medicine_name)
                    if stock is None:
                        continue
                    qty = 10
                    stock.quantity = max(0, stock.quantity - qty)
                    log = DispenseLog(
                        pharmacy_prescription_id=pharmacy_rx.id,
                        stock_item_id=stock.id,
                        quantity=qty,
                        dispensed_by=pharmacy_user.id,
                        dispensed_at=dispensed_at,
                        kind="dispense",
                    )
                    db.add(log)
                    db.flush()
                    last_log = log
                    total_amount += float(stock.unit_price) * qty

                if last_log is not None and total_amount > 0:
                    pharmacy_receipt_seq += 1
                    bill_paid = spec["payment_status"] in (PaymentStatus.paid, PaymentStatus.waived)
                    bill_status = (
                        BillingPaymentStatus.waived
                        if spec["payment_status"] == PaymentStatus.waived
                        else BillingPaymentStatus.paid
                        if bill_paid
                        else BillingPaymentStatus.pending
                    )
                    db.add(
                        BillingEntry(
                            patient_id=patient.id,
                            dispense_log_id=last_log.id,
                            description=f"Medicines dispensed for {patient.full_name}",
                            amount=total_amount,
                            payment_status=bill_status,
                            receipt_number=f"PHARM-{pharmacy_receipt_seq:04d}" if bill_status != BillingPaymentStatus.pending else None,
                            collected_by=pharmacy_user.id if bill_status != BillingPaymentStatus.pending else None,
                            paid_at=now if bill_status != BillingPaymentStatus.pending else None,
                        )
                    )

            # Vitals, for anyone actually admitted to a ward — several readings spread
            # from admission to now, with realistic variation (not identical rows), so
            # the ICU Key Sheet / vitals history reads like a real chart, not a stub.
            if spec["admission_type"] == AdmissionType.inpatient and spec["ward"]:
                recorder = nurse_by_ward.get(spec["ward"], nurse_user)
                span_seconds = (now - admitted_at).total_seconds()
                n_points = 5
                for i in range(n_points):
                    frac = (i + 1) / (n_points + 1)
                    recorded_at = admitted_at + dt.timedelta(seconds=max(span_seconds, 0) * frac)
                    db.add(
                        Vitals(
                            patient_id=patient.id,
                            recorded_by=recorder.id,
                            recorded_at=recorded_at,
                            temperature_c=round(random.uniform(36.7, 38.3), 1),
                            bp_systolic=random.randint(108, 138),
                            bp_diastolic=random.randint(68, 90),
                            pulse_bpm=random.randint(66, 108),
                            spo2_pct=random.randint(93, 99),
                            resp_rate=random.randint(14, 22),
                            blood_glucose=round(random.uniform(85, 145), 1),
                            flagged=False,
                        )
                    )

            # A live dose alert on the nurse dashboard for a couple of showcase wards
            if spec.get("alert_slot") and first_line is not None and spec["ward"] in nurse_by_ward:
                slots = FREQUENCY_SLOTS.get(first_line.frequency, [])
                slot_str = slots[0] if slots else "08:00"
                hour, minute = (int(part) for part in slot_str.split(":"))
                slot_time = dt.time(hour, minute)
                fire_at = now - dt.timedelta(minutes=10)
                db.add(
                    Alert(
                        patient_id=patient.id,
                        prescription_line_id=first_line.id,
                        scheduled_date=now.date(),
                        slot_time=slot_time,
                        fire_at=fire_at,
                        expire_at=fire_at + dt.timedelta(minutes=30),
                        status=AlertStatus.FIRED,
                        route_to=RouteTo.nurse,
                    )
                )

            db.commit()

        # ---- Staff salaries (current period) — mostly paid, a couple pending ---
        period = dt.date.today().strftime("%Y-%m")
        staff_users = db.execute(select(User).where(User.role != Role.patient)).scalars().all()
        salary_by_role = {
            Role.admin: 90000,
            Role.doctor: 120000,
            Role.head_nurse: 45000,
            Role.receptionist: 30000,
            Role.lab_staff: 35000,
            Role.pharmacist: 35000,
        }
        for i, user in enumerate(staff_users):
            amount = salary_by_role.get(user.role, 30000)
            salary, created = get_or_create(
                db,
                StaffSalary,
                user_id=user.id,
                period=period,
                defaults={"amount": amount, "notes": "Seeded demo salary"},
            )
            # Doctors' pay run hasn't happened yet this period — realistic payroll
            # timing, and it keeps the doctor leaderboard's net_contribution reading
            # pure consult-fee income instead of always going negative against a
            # full month's salary the moment it's marked paid.
            if created and user.role != Role.doctor and i % 4 != 0:  # leave ~1 in 4 pending, for a mixed demo view
                salary.status = SalaryStatus.paid
                salary.paid_at = now
                salary.paid_by = admin_user.id
        db.commit()

        print("Seed complete.")
        print("Demo logins (all under the seeded domain, passwords in this file):")
        print("  admin@cityhospital.com / Admin@123")
        print("  reception@cityhospital.com / Reception@123  (+ reception2@cityhospital.com)")
        print("  doctor.verma@cityhospital.com / Doctor@123  (Cardiology)")
        print("  doctor.joshi@cityhospital.com / Doctor@123  (Neurology)")
        print("  doctor.singh@cityhospital.com / Doctor@123  (Orthopedics)")
        print("  doctor.rao@cityhospital.com / Doctor@123  (Pediatrics)")
        print("  doctor.gupta@cityhospital.com / Doctor@123  (General Medicine)")
        print("  doctor.khan@cityhospital.com / Doctor@123  (Emergency)")
        print("  nurse@cityhospital.com / Nurse@123  (ward: General Ward)")
        print("  nurse.icu@cityhospital.com / Nurse@123  (ward: ICU)")
        print("  lab@cityhospital.com / Lab@123  (+ lab2@cityhospital.com)")
        print("  pharmacy@cityhospital.com / Pharmacy@123  (+ pharmacy2@cityhospital.com)")
        print(f"Seeded {len(DEMO_PATIENTS)} showcase patients (skipped any already present).")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
