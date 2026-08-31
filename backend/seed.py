"""Seeds reference/config data + one demo user per role + a couple of demo doctors
and a demo patient, so the app is usable immediately after `alembic upgrade head`.

Run from backend/: python seed.py   (or `docker-compose run --rm backend python seed.py`)

Idempotent: safe to re-run — every insert is guarded by a "does it already exist" check.
"""

import datetime as dt
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
    SpecialtyMapping,
    TestCatalogue,
    VitalsConfig,
)
from app.modules.auth.models import User
from app.modules.doctors.models import Doctor, DoctorRoster
from app.modules.patients.models import (
    AdmissionType,
    Gender,
    IntakeChannel,
    Patient,
    PaymentStatus,
    ProfileStatus,
)
from app.modules.pharmacy.models import StockItem

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
    ("Blood Test (CBC)", "Pathology", "Pathology", 2, 6),
    ("LFT", "Pathology", "Pathology", 2, 6),
    ("RFT", "Pathology", "Pathology", 2, 6),
    ("MRI", "Radiology", "Radiology", 4, 24),
    ("CT Scan", "Radiology", "Radiology", 2, 4),
    ("X-Ray", "Radiology", "Radiology", 1, 2),
    ("Ultrasound", "Radiology", "Radiology", 1, 3),
    ("ECG", "Cardiology", "Cardiology", 0.5, 0.5),
    ("Urine Analysis", "Pathology", "Pathology", 2, 4),
    ("Stool Analysis", "Pathology", "Pathology", 2, 4),
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

        for name, category, dept_name, tat_min, tat_max in TEST_CATALOGUE:
            get_or_create(
                db,
                TestCatalogue,
                name=name,
                defaults={
                    "category": category,
                    "department_id": dept_by_name[dept_name].id,
                    "tat_min_hours": tat_min,
                    "tat_max_hours": tat_max,
                },
            )
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
        expiry = dt.date.today() + dt.timedelta(days=365)
        for name, _dosage in MEDICINE_FORMULARY:
            get_or_create(
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
        db.commit()

        # ---- Demo users -------------------------------------------------------
        admin_user, _ = get_or_create(
            db,
            User,
            email="admin@cityhospital.com",
            defaults={
                "password_hash": hash_password("Admin@123"),
                "full_name": "Admin User",
                "phone": "9000000001",
                "role": Role.admin,
            },
        )

        get_or_create(
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

        get_or_create(
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

        get_or_create(
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

        doctor_user, _ = get_or_create(
            db,
            User,
            email="doctor.verma@cityhospital.com",
            defaults={
                "password_hash": hash_password("Doctor@123"),
                "full_name": "Dr. Amit Verma",
                "phone": "9000000006",
                "role": Role.doctor,
            },
        )
        doctor2_user, _ = get_or_create(
            db,
            User,
            email="doctor.joshi@cityhospital.com",
            defaults={
                "password_hash": hash_password("Doctor@123"),
                "full_name": "Dr. Neha Joshi",
                "phone": "9000000007",
                "role": Role.doctor,
            },
        )
        db.commit()

        doctor, _ = get_or_create(
            db,
            Doctor,
            user_id=doctor_user.id,
            defaults={"department_id": dept_by_name["Cardiology"].id, "specialty": "Cardiology", "is_active": True},
        )
        doctor2, _ = get_or_create(
            db,
            Doctor,
            user_id=doctor2_user.id,
            defaults={"department_id": dept_by_name["Neurology"].id, "specialty": "Neurology", "is_active": True},
        )
        db.commit()

        # On duty every day of the week, so auto-assignment always finds them
        # regardless of what day the demo is run on.
        for doc in (doctor, doctor2):
            for day in range(7):
                get_or_create(
                    db,
                    DoctorRoster,
                    doctor_id=doc.id,
                    day_of_week=day,
                    defaults={"is_on_duty": True, "max_patients": 20},
                )
        db.commit()

        # ---- Demo patient (matches the reference screenshots' example) --------
        existing_patient = db.execute(select(Patient).filter_by(id_number="DEMO-AADHAAR-1012")).scalar_one_or_none()
        if existing_patient is None:
            patient = Patient(
                id=uuid.uuid4(),
                full_name="Ravi Kumar",
                date_of_birth=dt.date(1989, 3, 12),
                gender=Gender.M,
                id_number="DEMO-AADHAAR-1012",
                blood_group="B+",
                mobile="9876543210",
                mobile_verified=True,
                email="ravikumar@example.com",
                address="123, Gandhi Nagar, Delhi - 110031",
                emergency_name="Suresh Kumar",
                emergency_phone="9876501234",
                intake_channel=IntakeChannel.emergency,
                profile_status=ProfileStatus.active,
                admission_type=AdmissionType.inpatient,
                chief_complaint="Fever, headache, body pain",
                ward="General Ward",
                department_id=dept_by_name["Cardiology"].id,
                doctor_id=doctor.id,
                admitted_at=dt.datetime.now(dt.timezone.utc),
                consult_fee=DEPARTMENT_FEES["Cardiology"],
                payment_status=PaymentStatus.deferred,
            )
            db.add(patient)
        db.commit()

        print("Seed complete.")
        print("Demo logins (all under the seeded domain, passwords in this file):")
        print("  admin@cityhospital.com / Admin@123")
        print("  reception@cityhospital.com / Reception@123")
        print("  doctor.verma@cityhospital.com / Doctor@123  (Cardiology)")
        print("  doctor.joshi@cityhospital.com / Doctor@123  (Neurology)")
        print("  nurse@cityhospital.com / Nurse@123  (ward: General Ward)")
        print("  lab@cityhospital.com / Lab@123")
        print("  pharmacy@cityhospital.com / Pharmacy@123")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
