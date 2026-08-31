import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.roles import Role
from app.core.security import create_access_token, hash_password
from app.db.mixins import utcnow
from app.modules.alerts.models import Alert, AlertStatus, RouteTo
from app.modules.auth.models import User
from app.modules.auth.service import verify_otp
from app.modules.doctors.models import Prescription, PrescriptionLine
from app.modules.nurses.models import MedicationLog
from app.modules.patient_app.schemas import MedicationHistoryOut, PatientAlertOut
from app.modules.patients.models import Patient


class PatientAppError(Exception):
    """Raised for a 400 — bad request / failed verification."""


class NotFoundError(Exception):
    """Raised for a 404 — no such record, or no record visible to this caller."""


def register(db: Session, *, patient_id: uuid.UUID, mobile: str, otp_code: str) -> tuple[str, User, Patient]:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise NotFoundError("No such patient")

    if patient.mobile != mobile:
        raise PatientAppError("Mobile number does not match this patient record")

    if not verify_otp(db, mobile=patient.mobile, code=otp_code, purpose="verify_mobile"):
        raise PatientAppError("Invalid or expired OTP")

    patient.mobile_verified = True

    user = db.execute(select(User).where(User.patient_profile_id == patient.id)).scalar_one_or_none()
    created = user is None
    if user is None:
        user = User(
            email=f"patient-{patient.id}@hms.local",
            password_hash=hash_password(str(uuid.uuid4())),
            full_name=patient.full_name,
            phone=patient.mobile,
            role=Role.patient,
            patient_profile_id=patient.id,
        )
        db.add(user)
        db.flush()  # assign user.id before the audit row and token are created

    record_audit(
        db,
        user_id=user.id,
        action="create" if created else "login",
        entity="patient_app_user",
        entity_id=user.id,
        new_value={"patient_id": str(patient.id), "mobile": patient.mobile},
    )
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id, role=user.role.value)
    return token, user, patient


def _require_patient_profile(user: User) -> uuid.UUID:
    if user.patient_profile_id is None:
        raise NotFoundError("This login is not linked to a patient record")
    return user.patient_profile_id


def get_active_prescription(db: Session, *, user: User) -> tuple[Prescription, list[PrescriptionLine]]:
    patient_id = _require_patient_profile(user)
    prescription = db.execute(
        select(Prescription).where(Prescription.patient_id == patient_id, Prescription.is_active.is_(True))
    ).scalar_one_or_none()
    if prescription is None:
        raise NotFoundError("No active prescription")

    lines = list(
        db.execute(
            select(PrescriptionLine).where(PrescriptionLine.prescription_id == prescription.id)
        ).scalars()
    )
    return prescription, lines


def get_alerts_today(db: Session, *, user: User) -> list[PatientAlertOut]:
    patient_id = _require_patient_profile(user)
    today = utcnow().date()

    stmt = (
        select(Alert, PrescriptionLine)
        .join(PrescriptionLine, Alert.prescription_line_id == PrescriptionLine.id)
        .where(
            Alert.patient_id == patient_id,
            Alert.scheduled_date == today,
            Alert.route_to == RouteTo.patient_app,
        )
        .order_by(Alert.slot_time)
    )
    rows = db.execute(stmt).all()
    return [
        PatientAlertOut(
            id=alert.id,
            prescription_line_id=line.id,
            medicine_name=line.medicine_name,
            dosage=line.dosage,
            route=line.route,
            with_food=line.with_food,
            special_instructions=line.special_instructions,
            scheduled_date=alert.scheduled_date,
            slot_time=alert.slot_time,
            fire_at=alert.fire_at,
            expire_at=alert.expire_at,
            status=alert.status,
        )
        for alert, line in rows
    ]


def mark_taken(db: Session, *, alert_id: uuid.UUID, user: User) -> Alert:
    patient_id = _require_patient_profile(user)

    alert = db.get(Alert, alert_id)
    if alert is None or alert.patient_id != patient_id:
        raise NotFoundError("No such alert for this patient")

    if alert.status == AlertStatus.GIVEN:
        raise PatientAppError("This dose has already been marked as taken")
    if alert.status == AlertStatus.CANCELLED:
        raise PatientAppError("This dose alert was cancelled")

    line = db.get(PrescriptionLine, alert.prescription_line_id)

    log = MedicationLog(
        alert_id=alert.id,
        prescription_line_id=alert.prescription_line_id,
        patient_id=patient_id,
        administered_by=user.id,
        dose_given=line.dosage if line is not None else None,
        route_used=line.route if line is not None else None,
        skipped=False,
    )
    db.add(log)

    old_status = alert.status.value
    alert.status = AlertStatus.GIVEN
    if alert.acknowledged_at is None:
        alert.acknowledged_at = utcnow()

    record_audit(
        db,
        user_id=user.id,
        action="create",
        entity="medication_log",
        entity_id=alert.id,
        new_value={"alert_id": str(alert.id), "dose_given": log.dose_given, "skipped": False},
    )
    record_audit(
        db,
        user_id=user.id,
        action="update",
        entity="alert",
        entity_id=alert.id,
        old_value={"status": old_status},
        new_value={"status": alert.status.value},
    )
    db.commit()
    db.refresh(alert)
    return alert


def get_history(db: Session, *, user: User) -> list[MedicationHistoryOut]:
    patient_id = _require_patient_profile(user)

    stmt = (
        select(MedicationLog, PrescriptionLine.medicine_name)
        .join(PrescriptionLine, MedicationLog.prescription_line_id == PrescriptionLine.id, isouter=True)
        .where(MedicationLog.patient_id == patient_id)
        .order_by(MedicationLog.administered_at.desc())
    )
    rows = db.execute(stmt).all()
    return [
        MedicationHistoryOut(
            id=log.id,
            alert_id=log.alert_id,
            prescription_line_id=log.prescription_line_id,
            medicine_name=medicine_name,
            administered_at=log.administered_at,
            dose_given=log.dose_given,
            route_used=log.route_used,
            skipped=log.skipped,
            skip_reason=log.skip_reason,
            notes=log.notes,
        )
        for log, medicine_name in rows
    ]
