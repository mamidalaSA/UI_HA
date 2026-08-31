import uuid
from datetime import datetime, timedelta, time as dt_time

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.celery_app import celery_app
from app.core.notify import doctor_user, notify_user, ward_nurses
from app.db.mixins import utcnow
from app.db.session import SessionLocal
from app.modules.admin.models import AlertWindowConfig
from app.modules.alerts.models import Alert, AlertStatus, RouteTo
from app.modules.doctors.models import (
    FREQUENCY_SLOTS,
    Prescription,
    PrescriptionLine,
)
from app.modules.patients.models import AdmissionType, Patient


def _alert_window(db) -> tuple[int, int]:
    cfg = db.execute(select(AlertWindowConfig)).scalars().first()
    if cfg is None:
        return 15, 30
    return cfg.fire_before_minutes, cfg.expire_after_minutes


@celery_app.task(name="alerts.generate_for_prescription", bind=True, max_retries=3)
def generate_alerts_for_prescription(self, prescription_id: str) -> int:
    """Runs the Module 5 algorithm: one alert row per (line, day, slot). Idempotent —
    relies on the DB unique constraint (prescription_line_id, scheduled_date, slot_time)
    so re-running (e.g. after a worker restart) never creates duplicates."""
    db = SessionLocal()
    try:
        prescription = db.get(Prescription, uuid.UUID(prescription_id))
        if prescription is None or not prescription.is_active:
            return 0
        patient = db.get(Patient, prescription.patient_id)
        if patient is None:
            return 0
        fire_before, expire_after = _alert_window(db)
        route_to = RouteTo.nurse if patient.admission_type == AdmissionType.inpatient else RouteTo.patient_app

        lines = db.execute(
            select(PrescriptionLine).where(PrescriptionLine.prescription_id == prescription.id)
        ).scalars().all()

        created = 0
        for line in lines:
            slots = FREQUENCY_SLOTS.get(line.frequency, [])
            for day_offset in range(line.duration_days):
                scheduled_date = line.start_date + timedelta(days=day_offset)
                for slot_str in slots:
                    hh, mm = (int(p) for p in slot_str.split(":"))
                    slot_time = dt_time(hour=hh, minute=mm)
                    dose_dt = datetime.combine(scheduled_date, slot_time)
                    fire_at = dose_dt - timedelta(minutes=fire_before)
                    expire_at = dose_dt + timedelta(minutes=expire_after)

                    stmt = (
                        pg_insert(Alert)
                        .values(
                            id=uuid.uuid4(),
                            patient_id=patient.id,
                            prescription_line_id=line.id,
                            scheduled_date=scheduled_date,
                            slot_time=slot_time,
                            fire_at=fire_at,
                            expire_at=expire_at,
                            status=AlertStatus.SCHEDULED,
                            route_to=route_to,
                        )
                        .on_conflict_do_nothing(
                            index_elements=["prescription_line_id", "scheduled_date", "slot_time"]
                        )
                    )
                    result = db.execute(stmt)
                    created += result.rowcount or 0
        db.commit()
        return created
    finally:
        db.close()


@celery_app.task(name="alerts.cancel_scheduled_for_prescription")
def cancel_scheduled_alerts_for_prescription(prescription_id: str) -> int:
    """Cancels SCHEDULED alerts tied to a prescription's lines — called when a
    prescription is revised (old version's future doses are void) or the patient
    is discharged."""
    db = SessionLocal()
    try:
        line_ids = db.execute(
            select(PrescriptionLine.id).where(PrescriptionLine.prescription_id == uuid.UUID(prescription_id))
        ).scalars().all()
        if not line_ids:
            return 0
        alerts = db.execute(
            select(Alert).where(Alert.prescription_line_id.in_(line_ids), Alert.status == AlertStatus.SCHEDULED)
        ).scalars().all()
        for alert in alerts:
            alert.status = AlertStatus.CANCELLED
        db.commit()
        return len(alerts)
    finally:
        db.close()


def _missed_in_last_24h(db, patient_id: uuid.UUID) -> int:
    since = utcnow() - timedelta(hours=24)
    return len(
        db.execute(
            select(Alert.id).where(
                Alert.patient_id == patient_id, Alert.status == AlertStatus.MISSED, Alert.expire_at >= since
            )
        ).scalars().all()
    )


@celery_app.task(name="alerts.sweep_dose_alerts")
def sweep_dose_alerts() -> dict:
    """Beat-scheduled every minute (see core/celery_app.py). Advances the alert
    status machine: SCHEDULED -> FIRED at fire_at, and FIRED/ACKNOWLEDGED -> MISSED
    past expire_at, with escalation on miss."""
    db = SessionLocal()
    now = utcnow()
    fired = missed = 0
    try:
        to_fire = db.execute(
            select(Alert).where(Alert.status == AlertStatus.SCHEDULED, Alert.fire_at <= now)
        ).scalars().all()
        for alert in to_fire:
            alert.status = AlertStatus.FIRED
            _notify_dose_due(db, alert)
            fired += 1
        db.commit()

        to_miss = db.execute(
            select(Alert).where(
                Alert.status.in_([AlertStatus.FIRED, AlertStatus.ACKNOWLEDGED]), Alert.expire_at < now
            )
        ).scalars().all()
        for alert in to_miss:
            alert.status = AlertStatus.MISSED
            _escalate_missed_dose(db, alert)
            missed += 1
        db.commit()
        return {"fired": fired, "missed": missed}
    finally:
        db.close()


def _notify_dose_due(db, alert: Alert) -> None:
    patient = db.get(Patient, alert.patient_id)
    if patient is None:
        return
    line = db.get(PrescriptionLine, alert.prescription_line_id)
    body = f"{line.medicine_name} {line.dosage} due for {patient.full_name}" if line else "Dose due"
    if alert.route_to == RouteTo.nurse and patient.ward:
        for nurse in ward_nurses(db, patient.ward):
            notify_user(db, user_id=nurse.id, title="Dose due", body=body)
    elif alert.route_to == RouteTo.patient_app and patient.doctor_id:
        # Patient-app routing targets the patient's own user account, resolved by the
        # caller's patient_profile_id linkage — looked up here to avoid a second query site.
        from app.modules.auth.models import User

        user = db.execute(select(User).where(User.patient_profile_id == patient.id)).scalars().first()
        if user:
            notify_user(db, user_id=user.id, title="Time for your medicine", body=body)


def _escalate_missed_dose(db, alert: Alert) -> None:
    patient = db.get(Patient, alert.patient_id)
    if patient is None or not patient.doctor_id:
        return
    line = db.get(PrescriptionLine, alert.prescription_line_id)
    med = line.medicine_name if line else "a dose"

    doc_user = doctor_user(db, patient.doctor_id)
    if doc_user:
        notify_user(
            db,
            user_id=doc_user.id,
            title="Missed dose",
            body=f"{patient.full_name} missed {med}",
            sms_to=doc_user.phone,
        )

    # Two consecutive missed doses within 24h -> also alert the emergency contact (Module 8 rule).
    # The push side of notify_user still targets the doctor (there is no app for the emergency
    # contact); sms_to is what actually reaches them.
    if _missed_in_last_24h(db, patient.id) >= 2 and doc_user:
        notify_user(
            db,
            user_id=doc_user.id,
            title="Repeated missed doses",
            body=f"{patient.full_name} has missed 2+ doses in 24h ({med})",
            sms_to=patient.emergency_phone,
        )
