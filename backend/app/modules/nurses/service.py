import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.notify import doctor_user, notify_user
from app.db.mixins import utcnow
from app.modules.admin.models import VitalsConfig
from app.modules.alerts.models import Alert, AlertStatus, RouteTo
from app.modules.auth.models import User
from app.modules.doctors.models import PrescriptionLine
from app.modules.nurses.models import MedicationLog, Vitals
from app.modules.nurses.schemas import EscalationCreate, MedicationLogCreate, VitalsCreate
from app.modules.patients.models import Patient


class NurseServiceError(Exception):
    pass


class NotFoundError(NurseServiceError):
    pass


class ForbiddenError(NurseServiceError):
    pass


class ValidationError(NurseServiceError):
    pass


# The subset of Vitals fields that are checked against vitals_config normal ranges.
# gcs_score is deliberately excluded — the spec's "normal ranges" table (Module 4) only
# lists the other seven, so there is no vitals_config row to compare it against.
VITAL_RANGE_FIELDS = (
    "temperature_c",
    "bp_systolic",
    "bp_diastolic",
    "pulse_bpm",
    "spo2_pct",
    "resp_rate",
    "blood_glucose",
)


def list_nurse_alerts(db: Session, *, user: User) -> list[dict]:
    """GET /api/nurse/alerts — active (FIRED/ACKNOWLEDGED) dose alerts routed to the
    nurse dashboard, restricted to patients in the calling nurse's ward."""
    if not user.ward:
        return []

    stmt = (
        select(Alert, Patient, PrescriptionLine)
        .join(Patient, Patient.id == Alert.patient_id)
        .join(PrescriptionLine, PrescriptionLine.id == Alert.prescription_line_id)
        .where(
            Alert.route_to == RouteTo.nurse,
            Alert.status.in_([AlertStatus.FIRED, AlertStatus.ACKNOWLEDGED]),
            Patient.ward == user.ward,
        )
        .order_by(Alert.fire_at)
    )
    rows = db.execute(stmt).all()
    result = []
    for alert, patient, line in rows:
        result.append(
            {
                "id": alert.id,
                "patient_id": patient.id,
                "patient_name": patient.full_name,
                "ward": patient.ward,
                "prescription_line_id": line.id,
                "medicine_name": line.medicine_name,
                "dosage": line.dosage,
                "route": line.route,
                "with_food": line.with_food,
                "special_instructions": line.special_instructions,
                "scheduled_date": alert.scheduled_date,
                "slot_time": alert.slot_time,
                "fire_at": alert.fire_at,
                "expire_at": alert.expire_at,
                "status": alert.status,
                "acknowledged_at": alert.acknowledged_at,
            }
        )
    return result


def _alert_patient_in_ward(db: Session, *, alert: Alert, user: User) -> Patient:
    """Alert doesn't carry ward directly — look up its patient and verify it matches
    the calling nurse's ward. Shared by acknowledge + log."""
    patient = db.get(Patient, alert.patient_id)
    if patient is None:
        raise NotFoundError("Patient not found")
    if not user.ward or patient.ward != user.ward:
        raise ForbiddenError("Patient is not in your ward")
    return patient


def acknowledge_alert(db: Session, *, user: User, alert_id: uuid.UUID) -> Alert:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise NotFoundError("Alert not found")
    _alert_patient_in_ward(db, alert=alert, user=user)

    if alert.status != AlertStatus.FIRED:
        raise ValidationError(f"Alert must be FIRED to acknowledge (currently {alert.status.value})")

    old_status = alert.status
    alert.status = AlertStatus.ACKNOWLEDGED
    alert.acknowledged_at = utcnow()

    record_audit(
        db,
        user_id=user.id,
        action="acknowledge",
        entity="alert",
        entity_id=alert.id,
        old_value={"status": old_status.value},
        new_value={"status": alert.status.value, "acknowledged_at": alert.acknowledged_at.isoformat()},
    )
    db.commit()
    db.refresh(alert)
    return alert


def log_dose(db: Session, *, user: User, alert_id: uuid.UUID, payload: MedicationLogCreate) -> MedicationLog:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise NotFoundError("Alert not found")
    _alert_patient_in_ward(db, alert=alert, user=user)

    # Pydantic validator already rejects skipped=true without skip_reason, but re-check
    # here too since service functions may be called outside the HTTP layer in future.
    if payload.skipped and not (payload.skip_reason and payload.skip_reason.strip()):
        raise ValidationError("skip_reason is required when skipped is true")

    line = db.get(PrescriptionLine, alert.prescription_line_id)

    dose_given = payload.dose_given
    if dose_given is None and not payload.skipped and line is not None:
        dose_given = line.dosage  # "defaults to prescribed" per spec
    route_used = payload.route_used
    if route_used is None and line is not None:
        route_used = line.route  # "defaults to prescribed route" per spec

    log = MedicationLog(
        alert_id=alert.id,
        prescription_line_id=alert.prescription_line_id,
        patient_id=alert.patient_id,
        administered_by=user.id,
        dose_given=dose_given,
        route_used=route_used,
        skipped=payload.skipped,
        skip_reason=payload.skip_reason,
        notes=payload.notes,
    )
    db.add(log)

    # A skipped-but-logged dose is "handled" — set GIVEN either way so the alert sweep
    # never later flips it to MISSED. Per task spec.
    old_status = alert.status
    alert.status = AlertStatus.GIVEN

    db.flush()  # assign log.id before the audit row references it
    record_audit(
        db,
        user_id=user.id,
        action="log_dose",
        entity="medication_log",
        entity_id=log.id,
        old_value={"alert_status": old_status.value},
        new_value={
            "alert_status": alert.status.value,
            "skipped": log.skipped,
            "dose_given": log.dose_given,
        },
    )
    db.commit()
    db.refresh(log)
    return log


def record_vitals(db: Session, *, user: User, patient: Patient, payload: VitalsCreate) -> Vitals:
    configs = {c.vital_name: c for c in db.execute(select(VitalsConfig)).scalars()}

    vitals = Vitals(
        patient_id=patient.id,
        recorded_by=user.id,
        temperature_c=payload.temperature_c,
        bp_systolic=payload.bp_systolic,
        bp_diastolic=payload.bp_diastolic,
        pulse_bpm=payload.pulse_bpm,
        spo2_pct=payload.spo2_pct,
        resp_rate=payload.resp_rate,
        blood_glucose=payload.blood_glucose,
        gcs_score=payload.gcs_score,
    )

    out_of_range: list[str] = []
    for field in VITAL_RANGE_FIELDS:
        value = getattr(payload, field)
        if value is None:
            continue
        cfg = configs.get(field)
        if cfg is None:
            continue  # not configured by Admin yet — nothing to compare against
        if not (float(cfg.min_value) <= float(value) <= float(cfg.max_value)):
            out_of_range.append(field)

    if out_of_range:
        vitals.flagged = True
        vitals.flag_reason = f"{', '.join(out_of_range)} out of range"

    db.add(vitals)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        action="create",
        entity="vitals",
        entity_id=vitals.id,
        new_value={"flagged": vitals.flagged, "flag_reason": vitals.flag_reason},
    )
    db.commit()
    db.refresh(vitals)

    if vitals.flagged and patient.doctor_id:
        doc_user = doctor_user(db, patient.doctor_id)
        if doc_user:
            notify_user(
                db,
                user_id=doc_user.id,
                title=f"Vitals flagged — {patient.full_name}",
                body=f"Out of range: {vitals.flag_reason}",
                sms_to=doc_user.phone,
                data={"patient_id": str(patient.id), "vitals_id": str(vitals.id)},
            )

    return vitals


def list_vitals(db: Session, *, patient: Patient) -> list[Vitals]:
    stmt = select(Vitals).where(Vitals.patient_id == patient.id).order_by(Vitals.recorded_at.desc())
    return list(db.execute(stmt).scalars())


def list_medication_log(db: Session, *, patient: Patient) -> list[MedicationLog]:
    stmt = (
        select(MedicationLog)
        .where(MedicationLog.patient_id == patient.id)
        .order_by(MedicationLog.administered_at.desc())
    )
    return list(db.execute(stmt).scalars())


def escalate(db: Session, *, user: User, payload: EscalationCreate) -> User | None:
    """POST /api/escalations — manual, live-only escalation to the patient's doctor.
    No DB table per the task spec; this just verifies scope and fires a notification."""
    patient = db.get(Patient, payload.patient_id)
    if patient is None:
        raise NotFoundError("Patient not found")
    if not user.ward or patient.ward != user.ward:
        raise ForbiddenError("Patient is not in your ward")
    if not payload.message or not payload.message.strip():
        raise ValidationError("message is required")

    doc_user = None
    if patient.doctor_id:
        doc_user = doctor_user(db, patient.doctor_id)

    record_audit(
        db,
        user_id=user.id,
        action="escalate",
        entity="patient",
        entity_id=patient.id,
        new_value={"message": payload.message, "notified_user_id": str(doc_user.id) if doc_user else None},
    )
    db.commit()

    if doc_user:
        notify_user(
            db,
            user_id=doc_user.id,
            title=f"Nurse escalation — {patient.full_name}",
            body=payload.message,
            sms_to=doc_user.phone,
            data={"patient_id": str(patient.id)},
        )
    return doc_user
