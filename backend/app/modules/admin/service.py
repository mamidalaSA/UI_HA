import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.roles import Role
from app.core.security import hash_password
from app.modules.admin.models import (
    AlertWindowConfig,
    AuditLog,
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
from app.modules.admin.schemas import (
    AlertWindowConfigUpsert,
    DepartmentCreate,
    DepartmentFeeUpsert,
    DepartmentSpecialtyCreate,
    DepartmentUpdate,
    DoctorRosterUpsert,
    MedicineFormularyCreate,
    MedicineFormularyUpdate,
    SpecialtyMappingCreate,
    StaffSalaryUpsert,
    TestCatalogueCreate,
    TestCatalogueUpdate,
    UserCreate,
    UserUpdate,
    VitalsConfigUpsert,
)
from app.modules.auth.models import User
from app.modules.doctors.models import Doctor, DoctorRoster
from app.modules.labs.models import LabPaymentStatus, TestOrder
from app.modules.patients.models import AdmissionType, PaymentStatus, Patient, ProfileStatus
from app.modules.pharmacy.models import BillingEntry, BillingPaymentStatus


class AdminServiceError(Exception):
    """Raised for business-rule violations; router translates this to HTTP 400/404/409."""


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


def create_user(db: Session, *, payload: UserCreate, actor: User) -> User:
    existing = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if existing is not None:
        raise AdminServiceError(f"A user with email {payload.email} already exists")

    if payload.role == Role.doctor and (payload.department_id is None or not payload.specialty):
        raise AdminServiceError("department_id and specialty are required when role=doctor")
    if payload.role == Role.head_nurse and not payload.ward:
        raise AdminServiceError("ward is required when role=head_nurse")

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        phone=payload.phone,
        role=payload.role,
        ward=payload.ward if payload.role == Role.head_nurse else None,
    )
    db.add(user)
    db.flush()

    if payload.role == Role.doctor:
        doctor = Doctor(
            user_id=user.id,
            department_id=payload.department_id,
            specialty=payload.specialty,
        )
        db.add(doctor)
        db.flush()

    record_audit(
        db,
        user_id=actor.id,
        action="create",
        entity="users",
        entity_id=user.id,
        new_value={"email": user.email, "role": user.role.value, "full_name": user.full_name},
    )
    db.commit()
    db.refresh(user)
    return user


def list_users(db: Session, *, role: Role | None = None) -> list[User]:
    stmt = select(User).order_by(User.created_at.desc())
    if role is not None:
        stmt = stmt.where(User.role == role)
    return list(db.execute(stmt).scalars().all())


def update_user(db: Session, *, user_id: uuid.UUID, payload: UserUpdate, actor: User) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise AdminServiceError("User not found")

    old_value = {
        "full_name": user.full_name,
        "phone": user.phone,
        "is_active": user.is_active,
        "role": user.role.value,
    }

    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.phone is not None:
        user.phone = payload.phone
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if payload.role is not None:
        user.role = payload.role

    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action="update",
        entity="users",
        entity_id=user.id,
        old_value=old_value,
        new_value={
            "full_name": user.full_name,
            "phone": user.phone,
            "is_active": user.is_active,
            "role": user.role.value,
        },
    )
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Doctors (read-only convenience listing, see schemas.DoctorOut)
# ---------------------------------------------------------------------------


def list_doctors(db: Session) -> list[dict]:
    rows = db.execute(select(Doctor, User).join(User, User.id == Doctor.user_id).order_by(User.full_name)).all()
    return [
        {
            "id": doctor.id,
            "user_id": doctor.user_id,
            "full_name": user.full_name,
            "email": user.email,
            "phone": user.phone,
            "is_active": doctor.is_active and user.is_active,
            "department_id": doctor.department_id,
            "specialty": doctor.specialty,
        }
        for doctor, user in rows
    ]


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------


def list_departments(db: Session) -> list[Department]:
    return list(db.execute(select(Department).order_by(Department.name)).scalars().all())


def create_department(db: Session, *, payload: DepartmentCreate, actor: User) -> Department:
    dept = Department(name=payload.name, code=payload.code)
    db.add(dept)
    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action="create",
        entity="departments",
        entity_id=dept.id,
        new_value={"name": dept.name, "code": dept.code},
    )
    db.commit()
    db.refresh(dept)
    return dept


def update_department(db: Session, *, department_id: uuid.UUID, payload: DepartmentUpdate, actor: User) -> Department:
    dept = db.get(Department, department_id)
    if dept is None:
        raise AdminServiceError("Department not found")

    old_value = {"name": dept.name, "code": dept.code}
    if payload.name is not None:
        dept.name = payload.name
    if payload.code is not None:
        dept.code = payload.code

    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action="update",
        entity="departments",
        entity_id=dept.id,
        old_value=old_value,
        new_value={"name": dept.name, "code": dept.code},
    )
    db.commit()
    db.refresh(dept)
    return dept


# ---------------------------------------------------------------------------
# Department fees
# ---------------------------------------------------------------------------


def list_department_fees(db: Session) -> list[DepartmentFee]:
    return list(db.execute(select(DepartmentFee)).scalars().all())


def upsert_department_fee(
    db: Session, *, department_id: uuid.UUID, payload: DepartmentFeeUpsert, actor: User
) -> DepartmentFee:
    dept = db.get(Department, department_id)
    if dept is None:
        raise AdminServiceError("Department not found")

    fee = db.execute(
        select(DepartmentFee).where(DepartmentFee.department_id == department_id)
    ).scalar_one_or_none()

    if fee is None:
        old_value = None
        fee = DepartmentFee(department_id=department_id, consult_fee=payload.consult_fee)
        db.add(fee)
        action = "create"
    else:
        old_value = {"consult_fee": float(fee.consult_fee)}
        fee.consult_fee = payload.consult_fee
        action = "update"

    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action=action,
        entity="department_fees",
        entity_id=fee.id,
        old_value=old_value,
        new_value={"consult_fee": float(fee.consult_fee)},
    )
    db.commit()
    db.refresh(fee)
    return fee


# ---------------------------------------------------------------------------
# Specialty mapping
# ---------------------------------------------------------------------------


def list_specialty_mapping(db: Session) -> list[SpecialtyMapping]:
    return list(db.execute(select(SpecialtyMapping).order_by(SpecialtyMapping.keyword)).scalars().all())


def create_specialty_mapping(db: Session, *, payload: SpecialtyMappingCreate, actor: User) -> SpecialtyMapping:
    mapping = SpecialtyMapping(keyword=payload.keyword, specialty=payload.specialty)
    db.add(mapping)
    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action="create",
        entity="specialty_mapping",
        entity_id=mapping.id,
        new_value={"keyword": mapping.keyword, "specialty": mapping.specialty},
    )
    db.commit()
    db.refresh(mapping)
    return mapping


def delete_specialty_mapping(db: Session, *, mapping_id: uuid.UUID, actor: User) -> None:
    mapping = db.get(SpecialtyMapping, mapping_id)
    if mapping is None:
        raise AdminServiceError("Specialty mapping not found")
    old_value = {"keyword": mapping.keyword, "specialty": mapping.specialty}
    db.delete(mapping)
    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action="delete",
        entity="specialty_mapping",
        entity_id=mapping_id,
        old_value=old_value,
    )
    db.commit()


# ---------------------------------------------------------------------------
# Department specialty
# ---------------------------------------------------------------------------


def list_department_specialty(db: Session) -> list[DepartmentSpecialty]:
    return list(db.execute(select(DepartmentSpecialty).order_by(DepartmentSpecialty.specialty)).scalars().all())


def create_department_specialty(
    db: Session, *, payload: DepartmentSpecialtyCreate, actor: User
) -> DepartmentSpecialty:
    dept = db.get(Department, payload.department_id)
    if dept is None:
        raise AdminServiceError("Department not found")

    row = DepartmentSpecialty(specialty=payload.specialty, department_id=payload.department_id)
    db.add(row)
    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action="create",
        entity="department_specialty",
        entity_id=row.id,
        new_value={"specialty": row.specialty, "department_id": str(row.department_id)},
    )
    db.commit()
    db.refresh(row)
    return row


# ---------------------------------------------------------------------------
# Doctor roster
# ---------------------------------------------------------------------------


def list_doctor_roster(db: Session, *, doctor_id: uuid.UUID | None = None) -> list[DoctorRoster]:
    stmt = select(DoctorRoster).order_by(DoctorRoster.day_of_week)
    if doctor_id is not None:
        stmt = stmt.where(DoctorRoster.doctor_id == doctor_id)
    return list(db.execute(stmt).scalars().all())


def upsert_doctor_roster(db: Session, *, payload: DoctorRosterUpsert, actor: User) -> DoctorRoster:
    doctor = db.get(Doctor, payload.doctor_id)
    if doctor is None:
        raise AdminServiceError("Doctor not found")

    row = db.execute(
        select(DoctorRoster).where(
            DoctorRoster.doctor_id == payload.doctor_id, DoctorRoster.day_of_week == payload.day_of_week
        )
    ).scalar_one_or_none()

    if row is None:
        old_value = None
        row = DoctorRoster(
            doctor_id=payload.doctor_id,
            day_of_week=payload.day_of_week,
            is_on_duty=payload.is_on_duty,
            max_patients=payload.max_patients,
        )
        db.add(row)
        action = "create"
    else:
        old_value = {"is_on_duty": row.is_on_duty, "max_patients": row.max_patients}
        row.is_on_duty = payload.is_on_duty
        row.max_patients = payload.max_patients
        action = "update"

    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action=action,
        entity="doctor_roster",
        entity_id=row.id,
        old_value=old_value,
        new_value={
            "doctor_id": str(row.doctor_id),
            "day_of_week": row.day_of_week,
            "is_on_duty": row.is_on_duty,
            "max_patients": row.max_patients,
        },
    )
    db.commit()
    db.refresh(row)
    return row


# ---------------------------------------------------------------------------
# Test catalogue
# ---------------------------------------------------------------------------


def list_test_catalogue(db: Session) -> list[TestCatalogue]:
    return list(db.execute(select(TestCatalogue).order_by(TestCatalogue.name)).scalars().all())


def create_test_catalogue(db: Session, *, payload: TestCatalogueCreate, actor: User) -> TestCatalogue:
    dept = db.get(Department, payload.department_id)
    if dept is None:
        raise AdminServiceError("Department not found")

    entry = TestCatalogue(
        name=payload.name,
        department_id=payload.department_id,
        category=payload.category,
        tat_min_hours=payload.tat_min_hours,
        tat_max_hours=payload.tat_max_hours,
        price=payload.price,
    )
    db.add(entry)
    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action="create",
        entity="test_catalogue",
        entity_id=entry.id,
        new_value={"name": entry.name, "department_id": str(entry.department_id)},
    )
    db.commit()
    db.refresh(entry)
    return entry


def update_test_catalogue(
    db: Session, *, entry_id: uuid.UUID, payload: TestCatalogueUpdate, actor: User
) -> TestCatalogue:
    entry = db.get(TestCatalogue, entry_id)
    if entry is None:
        raise AdminServiceError("Test catalogue entry not found")

    if payload.department_id is not None:
        dept = db.get(Department, payload.department_id)
        if dept is None:
            raise AdminServiceError("Department not found")

    old_value = {
        "name": entry.name,
        "department_id": str(entry.department_id),
        "category": entry.category,
        "tat_min_hours": float(entry.tat_min_hours),
        "tat_max_hours": float(entry.tat_max_hours),
    }

    if payload.name is not None:
        entry.name = payload.name
    if payload.department_id is not None:
        entry.department_id = payload.department_id
    if payload.category is not None:
        entry.category = payload.category
    if payload.tat_min_hours is not None:
        entry.tat_min_hours = payload.tat_min_hours
    if payload.tat_max_hours is not None:
        entry.tat_max_hours = payload.tat_max_hours
    if payload.price is not None:
        entry.price = payload.price

    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action="update",
        entity="test_catalogue",
        entity_id=entry.id,
        old_value=old_value,
        new_value={
            "name": entry.name,
            "department_id": str(entry.department_id),
            "category": entry.category,
            "tat_min_hours": float(entry.tat_min_hours),
            "tat_max_hours": float(entry.tat_max_hours),
        },
    )
    db.commit()
    db.refresh(entry)
    return entry


# ---------------------------------------------------------------------------
# Medicine formulary
# ---------------------------------------------------------------------------


def list_medicine_formulary(db: Session) -> list[MedicineFormulary]:
    return list(db.execute(select(MedicineFormulary).order_by(MedicineFormulary.name)).scalars().all())


def create_medicine_formulary(db: Session, *, payload: MedicineFormularyCreate, actor: User) -> MedicineFormulary:
    existing = db.execute(
        select(MedicineFormulary).where(MedicineFormulary.name == payload.name)
    ).scalar_one_or_none()
    if existing is not None:
        raise AdminServiceError(f"Medicine {payload.name} already exists in the formulary")

    entry = MedicineFormulary(
        name=payload.name, default_dosage=payload.default_dosage, is_approved=payload.is_approved
    )
    db.add(entry)
    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action="create",
        entity="medicine_formulary",
        entity_id=entry.id,
        new_value={"name": entry.name, "is_approved": entry.is_approved},
    )
    db.commit()
    db.refresh(entry)
    return entry


def update_medicine_formulary(
    db: Session, *, entry_id: uuid.UUID, payload: MedicineFormularyUpdate, actor: User
) -> MedicineFormulary:
    entry = db.get(MedicineFormulary, entry_id)
    if entry is None:
        raise AdminServiceError("Medicine formulary entry not found")

    old_value = {
        "name": entry.name,
        "default_dosage": entry.default_dosage,
        "is_approved": entry.is_approved,
    }

    if payload.name is not None:
        entry.name = payload.name
    if payload.default_dosage is not None:
        entry.default_dosage = payload.default_dosage
    if payload.is_approved is not None:
        entry.is_approved = payload.is_approved

    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action="update",
        entity="medicine_formulary",
        entity_id=entry.id,
        old_value=old_value,
        new_value={
            "name": entry.name,
            "default_dosage": entry.default_dosage,
            "is_approved": entry.is_approved,
        },
    )
    db.commit()
    db.refresh(entry)
    return entry


# ---------------------------------------------------------------------------
# Vitals config
# ---------------------------------------------------------------------------


def list_vitals_config(db: Session) -> list[VitalsConfig]:
    return list(db.execute(select(VitalsConfig).order_by(VitalsConfig.vital_name)).scalars().all())


def upsert_vitals_config(db: Session, *, vital_name: str, payload: VitalsConfigUpsert, actor: User) -> VitalsConfig:
    row = db.execute(select(VitalsConfig).where(VitalsConfig.vital_name == vital_name)).scalar_one_or_none()

    if row is None:
        old_value = None
        row = VitalsConfig(vital_name=vital_name, min_value=payload.min_value, max_value=payload.max_value)
        db.add(row)
        action = "create"
    else:
        old_value = {"min_value": float(row.min_value), "max_value": float(row.max_value)}
        row.min_value = payload.min_value
        row.max_value = payload.max_value
        action = "update"

    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action=action,
        entity="vitals_config",
        entity_id=row.id,
        old_value=old_value,
        new_value={"vital_name": row.vital_name, "min_value": float(row.min_value), "max_value": float(row.max_value)},
    )
    db.commit()
    db.refresh(row)
    return row


# ---------------------------------------------------------------------------
# Alert window config
# ---------------------------------------------------------------------------


def get_alert_window_config(db: Session) -> AlertWindowConfig | None:
    return db.execute(select(AlertWindowConfig)).scalars().first()


def upsert_alert_window_config(db: Session, *, payload: AlertWindowConfigUpsert, actor: User) -> AlertWindowConfig:
    row = db.execute(select(AlertWindowConfig)).scalars().first()

    if row is None:
        old_value = None
        row = AlertWindowConfig(
            fire_before_minutes=payload.fire_before_minutes, expire_after_minutes=payload.expire_after_minutes
        )
        db.add(row)
        action = "create"
    else:
        old_value = {
            "fire_before_minutes": row.fire_before_minutes,
            "expire_after_minutes": row.expire_after_minutes,
        }
        row.fire_before_minutes = payload.fire_before_minutes
        row.expire_after_minutes = payload.expire_after_minutes
        action = "update"

    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action=action,
        entity="alert_window_config",
        entity_id=row.id,
        old_value=old_value,
        new_value={
            "fire_before_minutes": row.fire_before_minutes,
            "expire_after_minutes": row.expire_after_minutes,
        },
    )
    db.commit()
    db.refresh(row)
    return row


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


def list_audit_log(
    db: Session,
    *,
    entity: str | None = None,
    user_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[AuditLog], int]:
    stmt = select(AuditLog)
    if entity is not None:
        stmt = stmt.where(AuditLog.entity == entity)
    if user_id is not None:
        stmt = stmt.where(AuditLog.user_id == user_id)

    total = db.execute(select(func.count()).select_from(stmt.subquery())).scalar_one()

    rows = db.execute(
        stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()
    return list(rows), int(total)


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


def reports_summary(db: Session) -> dict:
    total_patients = db.execute(select(func.count()).select_from(Patient)).scalar_one()

    admitted_patients = db.execute(
        select(func.count())
        .select_from(Patient)
        .where(Patient.profile_status == ProfileStatus.active, Patient.admission_type == AdmissionType.inpatient)
    ).scalar_one()

    discharged_patients = db.execute(
        select(func.count()).select_from(Patient).where(Patient.profile_status == ProfileStatus.discharged)
    ).scalar_one()

    total_doctors = db.execute(select(func.count()).select_from(Doctor)).scalar_one()

    total_nurses = db.execute(
        select(func.count()).select_from(User).where(User.role == Role.head_nurse)
    ).scalar_one()

    dept_rows = db.execute(
        select(Patient.department_id, Department.name, func.count())
        .select_from(Patient)
        .outerjoin(Department, Department.id == Patient.department_id)
        .group_by(Patient.department_id, Department.name)
    ).all()
    by_department = [
        {"department_id": dept_id, "department_name": dept_name, "count": count}
        for dept_id, dept_name, count in dept_rows
    ]

    gender_rows = db.execute(select(Patient.gender, func.count()).group_by(Patient.gender)).all()
    by_gender = [{"gender": gender.value, "count": count} for gender, count in gender_rows]

    # Consult-fee billing (patients.payment_status). "Pending" groups every status that
    # still represents money owed but not yet collected — link_sent and deferred included,
    # since both are outstanding from the hospital's point of view, just at different stages.
    consult_rows = db.execute(
        select(Patient.payment_status, func.count(), func.coalesce(func.sum(Patient.consult_fee), 0))
        .where(Patient.consult_fee.is_not(None))
        .group_by(Patient.payment_status)
    ).all()
    consult_billing = {"paid_count": 0, "paid_amount": 0.0, "pending_count": 0, "pending_amount": 0.0, "waived_count": 0, "waived_amount": 0.0}
    for pay_status, count, total in consult_rows:
        amount = float(total)
        if pay_status == PaymentStatus.paid:
            consult_billing["paid_count"] += count
            consult_billing["paid_amount"] += amount
        elif pay_status == PaymentStatus.waived:
            consult_billing["waived_count"] += count
            consult_billing["waived_amount"] += amount
        else:  # pending, link_sent, deferred
            consult_billing["pending_count"] += count
            consult_billing["pending_amount"] += amount

    # Pharmacy billing (billing_entries.payment_status) — a separate stream from consult
    # fees, collected at the pharmacy counter (see BillingEntry).
    pharmacy_rows = db.execute(
        select(BillingEntry.payment_status, func.count(), func.coalesce(func.sum(BillingEntry.amount), 0)).group_by(
            BillingEntry.payment_status
        )
    ).all()
    pharmacy_billing = {"paid_count": 0, "paid_amount": 0.0, "pending_count": 0, "pending_amount": 0.0, "waived_count": 0, "waived_amount": 0.0}
    for pay_status, count, total in pharmacy_rows:
        amount = float(total)
        if pay_status == BillingPaymentStatus.paid:
            pharmacy_billing["paid_count"] += count
            pharmacy_billing["paid_amount"] += amount
        elif pay_status == BillingPaymentStatus.waived:
            pharmacy_billing["waived_count"] += count
            pharmacy_billing["waived_amount"] += amount
        else:  # pending
            pharmacy_billing["pending_count"] += count
            pharmacy_billing["pending_amount"] += amount

    return {
        "total_patients": int(total_patients),
        "admitted_patients": int(admitted_patients),
        "discharged_patients": int(discharged_patients),
        "total_doctors": int(total_doctors),
        "total_nurses": int(total_nurses),
        "by_department": by_department,
        "by_gender": by_gender,
        "consult_billing": consult_billing,
        "pharmacy_billing": pharmacy_billing,
        "pharmacy_daily": _daily_billing(
            db, amount_col=BillingEntry.amount, status_col=BillingEntry.payment_status,
            paid_at_col=BillingEntry.paid_at, paid_status=BillingPaymentStatus.paid,
            pending_status=BillingPaymentStatus.pending,
        ),
        "labs_daily": _daily_billing(
            db, amount_col=TestOrder.amount, status_col=TestOrder.payment_status,
            paid_at_col=TestOrder.paid_at, paid_status=LabPaymentStatus.paid,
            pending_status=LabPaymentStatus.pending,
        ),
    }


def _daily_billing(db: Session, *, amount_col, status_col, paid_at_col, paid_status, pending_status) -> dict:
    """Shared today's-collections-vs-outstanding-dues computation for any billing
    stream that follows the amount/payment_status/paid_at shape (pharmacy, labs)."""
    today = datetime.now(timezone.utc).date()
    today_start = datetime(today.year, today.month, today.day, tzinfo=timezone.utc)
    today_end = today_start + timedelta(days=1)

    collected_today = db.execute(
        select(func.coalesce(func.sum(amount_col), 0)).where(
            status_col == paid_status, paid_at_col >= today_start, paid_at_col < today_end
        )
    ).scalar_one()
    dues = db.execute(
        select(func.coalesce(func.sum(amount_col), 0)).where(status_col == pending_status)
    ).scalar_one()

    return {"collected_today": float(collected_today), "dues": float(dues)}


# ---------------------------------------------------------------------------
# Patient bills (per-patient payment history across both billing streams)
# ---------------------------------------------------------------------------


def list_patient_bills(db: Session) -> list[dict]:
    pharmacy_agg = (
        select(
            BillingEntry.patient_id.label("patient_id"),
            func.sum(
                case((BillingEntry.payment_status == BillingPaymentStatus.paid, BillingEntry.amount), else_=0)
            ).label("paid"),
            func.sum(
                case((BillingEntry.payment_status == BillingPaymentStatus.pending, BillingEntry.amount), else_=0)
            ).label("pending"),
            func.count(BillingEntry.id).label("entries"),
        )
        .group_by(BillingEntry.patient_id)
        .subquery()
    )

    rows = db.execute(
        select(Patient, pharmacy_agg.c.paid, pharmacy_agg.c.pending, pharmacy_agg.c.entries)
        .outerjoin(pharmacy_agg, pharmacy_agg.c.patient_id == Patient.id)
        .order_by(Patient.created_at.desc())
    ).all()

    result: list[dict] = []
    for patient, ph_paid, ph_pending, ph_entries in rows:
        consult_fee = float(patient.consult_fee) if patient.consult_fee is not None else None
        consult_paid = consult_fee if (consult_fee is not None and patient.payment_status == PaymentStatus.paid) else 0.0
        consult_pending = (
            consult_fee
            if (consult_fee is not None and patient.payment_status in (PaymentStatus.pending, PaymentStatus.link_sent, PaymentStatus.deferred))
            else 0.0
        )
        pharmacy_paid = float(ph_paid or 0)
        pharmacy_pending = float(ph_pending or 0)
        result.append(
            {
                "patient_id": patient.id,
                "patient_name": patient.full_name,
                "mobile": patient.mobile,
                "consult_fee": consult_fee,
                "consult_payment_status": patient.payment_status,
                "pharmacy_paid_amount": pharmacy_paid,
                "pharmacy_pending_amount": pharmacy_pending,
                "pharmacy_entries": int(ph_entries or 0),
                "total_paid": consult_paid + pharmacy_paid,
                "total_pending": consult_pending + pharmacy_pending,
            }
        )
    return result


# ---------------------------------------------------------------------------
# Staff salaries
# ---------------------------------------------------------------------------


def list_staff_salaries(db: Session, *, period: str) -> list[dict]:
    """Every non-patient user, left-joined with their salary record for `period` —
    staff with no record yet still appear, with amount/status/salary_id null, so the
    admin UI can offer to set one instead of just omitting them."""
    rows = db.execute(
        select(User, StaffSalary)
        .outerjoin(StaffSalary, (StaffSalary.user_id == User.id) & (StaffSalary.period == period))
        .where(User.role != Role.patient)
        .order_by(User.role, User.full_name)
    ).all()

    return [
        {
            "user_id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "salary_id": salary.id if salary else None,
            "period": period,
            "amount": float(salary.amount) if salary else None,
            "status": salary.status if salary else None,
            "paid_at": salary.paid_at if salary else None,
            "notes": salary.notes if salary else None,
        }
        for user, salary in rows
    ]


def upsert_staff_salary(db: Session, *, payload: StaffSalaryUpsert, actor: User) -> StaffSalary:
    user = db.get(User, payload.user_id)
    if user is None or user.role == Role.patient:
        raise AdminServiceError("Staff user not found")

    existing = db.execute(
        select(StaffSalary).where(StaffSalary.user_id == payload.user_id, StaffSalary.period == payload.period)
    ).scalar_one_or_none()

    if existing is not None:
        if existing.status == SalaryStatus.paid:
            raise AdminServiceError("This period's salary has already been paid — cannot edit the amount")
        old_value = {"amount": float(existing.amount)}
        existing.amount = payload.amount
        existing.notes = payload.notes
        record_audit(
            db,
            user_id=actor.id,
            action="update",
            entity="staff_salaries",
            entity_id=existing.id,
            old_value=old_value,
            new_value={"amount": payload.amount},
        )
        db.commit()
        db.refresh(existing)
        return existing

    salary = StaffSalary(
        user_id=payload.user_id,
        period=payload.period,
        amount=payload.amount,
        notes=payload.notes,
    )
    db.add(salary)
    db.flush()
    record_audit(
        db,
        user_id=actor.id,
        action="create",
        entity="staff_salaries",
        entity_id=salary.id,
        new_value={"user_id": str(payload.user_id), "period": payload.period, "amount": payload.amount},
    )
    db.commit()
    db.refresh(salary)
    return salary


def mark_salary_paid(db: Session, *, salary_id: uuid.UUID, actor: User) -> StaffSalary:
    salary = db.get(StaffSalary, salary_id)
    if salary is None:
        raise AdminServiceError("Salary record not found")
    if salary.status == SalaryStatus.paid:
        raise AdminServiceError("This salary has already been marked paid")

    salary.status = SalaryStatus.paid
    salary.paid_at = datetime.now(timezone.utc)
    salary.paid_by = actor.id

    record_audit(
        db,
        user_id=actor.id,
        action="pay",
        entity="staff_salaries",
        entity_id=salary.id,
        new_value={"status": "paid", "amount": float(salary.amount)},
    )
    db.commit()
    db.refresh(salary)
    return salary


# ---------------------------------------------------------------------------
# Doctor financials (income generated vs. salary paid, per doctor)
# ---------------------------------------------------------------------------


def list_doctor_stats(db: Session) -> list[dict]:
    """Per-doctor consult-fee income (their assigned patients' bills) against what
    they've been paid in salary — an all-time profitability view, not scoped to a
    single period, so admin sees the full picture per doctor at a glance."""
    fee = func.coalesce(Patient.consult_fee, 0)
    income_rows = {
        row.doctor_id: row
        for row in db.execute(
            select(
                Patient.doctor_id.label("doctor_id"),
                func.count(Patient.id).label("patients_count"),
                func.sum(case((Patient.payment_status == PaymentStatus.paid, fee), else_=0)).label("income_paid"),
                func.sum(
                    case(
                        (
                            Patient.payment_status.in_(
                                [PaymentStatus.pending, PaymentStatus.link_sent, PaymentStatus.deferred]
                            ),
                            fee,
                        ),
                        else_=0,
                    )
                ).label("income_pending"),
            )
            .where(Patient.doctor_id.is_not(None))
            .group_by(Patient.doctor_id)
        ).all()
    }

    salary_rows = {
        row.user_id: row
        for row in db.execute(
            select(
                StaffSalary.user_id.label("user_id"),
                func.sum(case((StaffSalary.status == SalaryStatus.paid, StaffSalary.amount), else_=0)).label(
                    "salary_paid"
                ),
                func.sum(case((StaffSalary.status == SalaryStatus.pending, StaffSalary.amount), else_=0)).label(
                    "salary_pending"
                ),
            ).group_by(StaffSalary.user_id)
        ).all()
    }

    doctors = db.execute(
        select(Doctor, User, Department)
        .join(User, User.id == Doctor.user_id)
        .outerjoin(Department, Department.id == Doctor.department_id)
        .order_by(User.full_name)
    ).all()

    result: list[dict] = []
    for doctor, user, department in doctors:
        income = income_rows.get(doctor.id)
        salary = salary_rows.get(user.id)
        income_paid = float(income.income_paid or 0) if income else 0.0
        income_pending = float(income.income_pending or 0) if income else 0.0
        salary_paid = float(salary.salary_paid or 0) if salary else 0.0
        salary_pending = float(salary.salary_pending or 0) if salary else 0.0
        result.append(
            {
                "doctor_id": doctor.id,
                "user_id": user.id,
                "full_name": user.full_name,
                "email": user.email,
                "specialty": doctor.specialty,
                "department_id": doctor.department_id,
                "department_name": department.name if department else None,
                "is_active": doctor.is_active,
                "patients_count": int(income.patients_count) if income else 0,
                "income_paid": income_paid,
                "income_pending": income_pending,
                "salary_paid": salary_paid,
                "salary_pending": salary_pending,
                "net_contribution": income_paid - salary_paid,
            }
        )
    return result
