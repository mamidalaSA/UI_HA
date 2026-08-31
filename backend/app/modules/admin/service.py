import uuid

from sqlalchemy import func, select
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
    SpecialtyMapping,
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
    TestCatalogueCreate,
    TestCatalogueUpdate,
    UserCreate,
    UserUpdate,
    VitalsConfigUpsert,
)
from app.modules.auth.models import User
from app.modules.doctors.models import Doctor, DoctorRoster
from app.modules.patients.models import AdmissionType, Patient, ProfileStatus


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

    return {
        "total_patients": int(total_patients),
        "admitted_patients": int(admitted_patients),
        "discharged_patients": int(discharged_patients),
        "total_doctors": int(total_doctors),
        "total_nurses": int(total_nurses),
        "by_department": by_department,
        "by_gender": by_gender,
    }
