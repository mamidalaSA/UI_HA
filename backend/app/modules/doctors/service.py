import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.notify import notify_user
from app.core.roles import Role
from app.db.mixins import utcnow
from app.modules.admin.models import TestCatalogue
from app.modules.alerts.models import Alert, AlertStatus
from app.modules.auth.models import User
from app.modules.doctors.models import Doctor, ExaminationNote, Prescription, PrescriptionLine
from app.modules.doctors.schemas import PrescriptionCreate
from app.modules.labs.models import TestOrder, TestOrderStatus
from app.modules.patients.models import AdmissionType, Patient, ProfileStatus
from app.modules.pharmacy.models import DispenseStatus, PharmacyPrescription
from app.workers.alert_tasks import cancel_scheduled_alerts_for_prescription, generate_alerts_for_prescription


class DoctorServiceError(Exception):
    """Raised for business-rule violations; routers translate this to HTTP 400/404/409."""


def _attach_lines(db: Session, prescriptions: list[Prescription]) -> list[Prescription]:
    """Prescription has no ORM `lines` relationship (models.py is frozen ground truth
    for this build), so PrescriptionOut.lines would otherwise always serialize to its
    empty default. Fetch the lines and attach them as a plain attribute before
    returning so `from_attributes` response serialization picks them up."""
    if not prescriptions:
        return prescriptions
    ids = [p.id for p in prescriptions]
    all_lines = db.execute(
        select(PrescriptionLine).where(PrescriptionLine.prescription_id.in_(ids))
    ).scalars().all()
    by_prescription: dict[uuid.UUID, list[PrescriptionLine]] = {p.id: [] for p in prescriptions}
    for line in all_lines:
        by_prescription[line.prescription_id].append(line)
    for p in prescriptions:
        p.lines = by_prescription[p.id]  # type: ignore[attr-defined]
    return prescriptions


# ---------------------------------------------------------------------------
# Patient list
# ---------------------------------------------------------------------------


def list_doctor_patients(db: Session, doctor: Doctor) -> tuple[list[Patient], dict[uuid.UUID, object], int]:
    """Returns (patients, {patient_id: last_note_at}, pending_reports_count).

    Spec Module 3 step 1 says patients should be "sorted by urgency" but Patient has
    no urgency/acuity field. We approximate: inpatients first (higher-acuity care
    setting), then earliest-admitted first within each group.
    """
    patients = (
        db.execute(
            select(Patient)
            .where(Patient.doctor_id == doctor.id)
            .order_by(
                (Patient.admission_type != AdmissionType.inpatient),
                Patient.admitted_at.asc(),
            )
        )
        .scalars()
        .all()
    )

    last_note_map: dict[uuid.UUID, object] = {}
    if patients:
        patient_ids = [p.id for p in patients]
        rows = db.execute(
            select(ExaminationNote.patient_id, func.max(ExaminationNote.created_at))
            .where(ExaminationNote.patient_id.in_(patient_ids))
            .group_by(ExaminationNote.patient_id)
        ).all()
        last_note_map = {pid: last_at for pid, last_at in rows}

    pending_reports_count = db.execute(
        select(func.count())
        .select_from(TestOrder)
        .where(TestOrder.doctor_id == doctor.id, TestOrder.status == TestOrderStatus.completed)
    ).scalar_one()

    return list(patients), last_note_map, int(pending_reports_count)


# ---------------------------------------------------------------------------
# Examination notes
# ---------------------------------------------------------------------------


def list_notes(db: Session, *, patient_id: uuid.UUID) -> list[ExaminationNote]:
    """Not in the spec's explicit endpoint list, but required to render the patient
    detail page's notes list — ExaminationNote has no reader anywhere else in the spec
    and this module owns the table, so exposing a GET here is the natural fit."""
    return list(
        db.execute(
            select(ExaminationNote)
            .where(ExaminationNote.patient_id == patient_id)
            .order_by(ExaminationNote.created_at.desc())
        )
        .scalars()
        .all()
    )


def create_note(db: Session, *, patient: Patient, doctor: Doctor, user: User, note_text: str) -> ExaminationNote:
    note = ExaminationNote(patient_id=patient.id, doctor_id=doctor.id, note_text=note_text)
    db.add(note)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        action="create",
        entity="examination_notes",
        entity_id=note.id,
        new_value={"patient_id": str(patient.id), "note_text": note_text},
    )
    db.commit()
    db.refresh(note)
    return note


# ---------------------------------------------------------------------------
# Test orders
# ---------------------------------------------------------------------------


def create_test_order(
    db: Session, *, patient: Patient, doctor: Doctor, user: User, test_type_id: uuid.UUID, notes: str | None
) -> TestOrder:
    catalogue_entry = db.get(TestCatalogue, test_type_id)
    if catalogue_entry is None:
        raise DoctorServiceError("Unknown test_type_id — not found in test catalogue")

    order = TestOrder(
        patient_id=patient.id,
        doctor_id=doctor.id,
        test_type_id=test_type_id,
        status=TestOrderStatus.pending,
        notes=notes,
    )
    db.add(order)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        action="create",
        entity="test_orders",
        entity_id=order.id,
        new_value={"patient_id": str(patient.id), "test_type_id": str(test_type_id)},
    )
    db.commit()
    db.refresh(order)

    # Optional: nudge lab staff that a new order is waiting. Not required by the
    # endpoint list, but cheap and matches the Module 7 workflow ("lab notified").
    lab_staff = db.execute(select(User).where(User.role == Role.lab_staff, User.is_active.is_(True))).scalars().all()
    for staff in lab_staff:
        notify_user(
            db,
            user_id=staff.id,
            title="New test order",
            body=f"{catalogue_entry.name} ordered for {patient.full_name}",
        )

    return order


def review_test_order(db: Session, *, test_order_id: uuid.UUID, doctor: Doctor, user: User) -> TestOrder:
    order = db.get(TestOrder, test_order_id)
    if order is None:
        raise DoctorServiceError("Test order not found")
    if order.doctor_id != doctor.id:
        raise DoctorServiceError("You did not order this test")
    if order.status != TestOrderStatus.completed:
        raise DoctorServiceError("Only completed test orders can be reviewed")

    old_status = order.status
    order.status = TestOrderStatus.reviewed
    order.reviewed_at = utcnow()
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        action="update",
        entity="test_orders",
        entity_id=order.id,
        old_value={"status": old_status.value},
        new_value={"status": order.status.value},
    )
    db.commit()
    db.refresh(order)
    return order


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------


def create_or_revise_prescription(
    db: Session, *, patient: Patient, doctor: Doctor, user: User, payload: PrescriptionCreate
) -> Prescription:
    existing_active = db.execute(
        select(Prescription).where(Prescription.patient_id == patient.id, Prescription.is_active.is_(True))
    ).scalar_one_or_none()

    version = 1
    if existing_active is not None:
        existing_active.is_active = False
        existing_active.archived_at = utcnow()
        version = existing_active.version + 1
        db.flush()
        record_audit(
            db,
            user_id=user.id,
            action="update",
            entity="prescriptions",
            entity_id=existing_active.id,
            old_value={"is_active": True},
            new_value={"is_active": False, "archived_at": existing_active.archived_at.isoformat()},
        )

    new_prescription = Prescription(
        patient_id=patient.id,
        doctor_id=doctor.id,
        version=version,
        is_active=True,
        notes=payload.notes,
    )
    db.add(new_prescription)
    db.flush()

    for line in payload.lines:
        db.add(
            PrescriptionLine(
                prescription_id=new_prescription.id,
                medicine_name=line.medicine_name,
                dosage=line.dosage,
                route=line.route,
                frequency=line.frequency,
                start_date=line.start_date,
                duration_days=line.duration_days,
                with_food=line.with_food,
                special_instructions=line.special_instructions,
            )
        )

    # Module 6 step 1: "Doctor saves prescription — appears in pharmacy queue immediately".
    db.add(
        PharmacyPrescription(
            prescription_id=new_prescription.id,
            patient_id=patient.id,
            status=DispenseStatus.pending,
        )
    )

    record_audit(
        db,
        user_id=user.id,
        action="create",
        entity="prescriptions",
        entity_id=new_prescription.id,
        new_value={"patient_id": str(patient.id), "version": version, "line_count": len(payload.lines)},
    )

    db.commit()
    db.refresh(new_prescription)

    if existing_active is not None:
        cancel_scheduled_alerts_for_prescription.delay(str(existing_active.id))
    generate_alerts_for_prescription.delay(str(new_prescription.id))

    _attach_lines(db, [new_prescription])
    return new_prescription


def list_prescriptions(db: Session, *, patient_id: uuid.UUID) -> list[Prescription]:
    prescriptions = list(
        db.execute(
            select(Prescription)
            .where(Prescription.patient_id == patient_id)
            .order_by(Prescription.version.desc())
        )
        .scalars()
        .all()
    )
    return _attach_lines(db, prescriptions)


# ---------------------------------------------------------------------------
# Discharge
# ---------------------------------------------------------------------------


def discharge_patient(db: Session, *, patient: Patient, doctor: Doctor, user: User) -> tuple[Patient, int]:
    has_note = db.execute(
        select(ExaminationNote.id).where(ExaminationNote.patient_id == patient.id).limit(1)
    ).scalar_one_or_none()
    if has_note is None:
        raise DoctorServiceError("Discharge requires at least one examination note on record")

    old_status = patient.profile_status
    patient.profile_status = ProfileStatus.discharged
    patient.discharged_at = utcnow()

    pending_alerts = db.execute(
        select(Alert).where(
            Alert.patient_id == patient.id,
            Alert.status.in_([AlertStatus.SCHEDULED, AlertStatus.FIRED, AlertStatus.ACKNOWLEDGED]),
        )
    ).scalars().all()
    for alert in pending_alerts:
        alert.status = AlertStatus.CANCELLED

    db.flush()
    record_audit(
        db,
        user_id=user.id,
        action="discharge",
        entity="patients",
        entity_id=patient.id,
        old_value={"profile_status": old_status.value},
        new_value={"profile_status": patient.profile_status.value, "cancelled_alerts": len(pending_alerts)},
    )
    db.commit()
    db.refresh(patient)
    return patient, len(pending_alerts)
