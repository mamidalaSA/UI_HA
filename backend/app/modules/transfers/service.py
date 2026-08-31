import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.notify import doctor_user, notify_user
from app.core.roles import Role
from app.db.mixins import utcnow
from app.modules.auth.models import User
from app.modules.doctors.models import Doctor, DoctorRoster, ExaminationNote
from app.modules.patients.models import Patient, ProfileStatus
from app.modules.transfers.models import PatientTransfer, TransferStatus, TransferType, Urgency
from app.modules.transfers.schemas import TransferInitiate

MIN_REASON_LENGTH = 20
DECLINE_ESCALATION_THRESHOLD = 3


class TransferError(Exception):
    """Raised for any business-rule violation in this module; carries the HTTP status
    the router should respond with, so callers don't have to re-derive it."""

    def __init__(self, status_code: int, message: str):
        self.status_code = status_code
        self.message = message
        super().__init__(message)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _admin_users(db: Session) -> list[User]:
    return list(db.execute(select(User).where(User.role == Role.admin, User.is_active.is_(True))).scalars())


def _auto_assign_doctor(
    db: Session, dept_id: uuid.UUID, *, exclude_doctor_ids: set[uuid.UUID] | None = None
) -> Doctor | None:
    """Load-balancing auto-assignment: among doctors in `dept_id` who have a
    DoctorRoster row marking them on-duty today, pick the one with fewest active
    patients. Mirrors reception's auto-assignment behavior; implemented locally
    per task instructions rather than imported from the patients module."""
    exclude_doctor_ids = exclude_doctor_ids or set()
    today_dow = utcnow().weekday()  # 0=Monday .. 6=Sunday, matches DoctorRoster.day_of_week

    query = (
        select(Doctor)
        .join(DoctorRoster, DoctorRoster.doctor_id == Doctor.id)
        .where(
            Doctor.department_id == dept_id,
            Doctor.is_active.is_(True),
            DoctorRoster.day_of_week == today_dow,
            DoctorRoster.is_on_duty.is_(True),
        )
    )
    if exclude_doctor_ids:
        query = query.where(Doctor.id.notin_(exclude_doctor_ids))

    candidates = list(db.execute(query).scalars().unique())
    if not candidates:
        return None

    load: dict[uuid.UUID, int] = {}
    for doc in candidates:
        load[doc.id] = db.execute(
            select(func.count(Patient.id)).where(
                Patient.doctor_id == doc.id, Patient.profile_status == ProfileStatus.active
            )
        ).scalar_one()

    return min(candidates, key=lambda d: load[d.id])


def _stub_discharge_summary_url(transfer_id: uuid.UUID) -> str:
    # STUB: there is no PDF-generation library in requirements.txt for this pass, so
    # this returns a deterministic placeholder path rather than a real generated file.
    # Swap this out for a real renderer (e.g. weasyprint/reportlab writing to the
    # storage integration) once that dependency is added; callers only depend on
    # `discharge_summary_url` being a non-null string, so the swap is contained here.
    return f"discharge-summaries/{transfer_id}.pdf"


def _ensure_discharge_summary(db: Session, transfer: PatientTransfer, *, user_id: uuid.UUID | None) -> None:
    if transfer.discharge_summary_url is None:
        transfer.discharge_summary_url = _stub_discharge_summary_url(transfer.id)
        record_audit(
            db,
            user_id=user_id,
            action="update",
            entity="patient_transfers",
            entity_id=transfer.id,
            new_value={"discharge_summary_url": transfer.discharge_summary_url},
        )


def _parse_declined_doctor_ids(decline_reason: str | None) -> set[uuid.UUID]:
    """decline_reason doubles as an append-only log of `[doctor_id] reason` entries
    (and, for cancellations, `[cancelled by user_id] reason`) since the model has no
    dedicated column for either. This recovers the set of doctors who have already
    declined this transfer, used to exclude them on re-pick."""
    declined: set[uuid.UUID] = set()
    if not decline_reason:
        return declined
    for line in decline_reason.splitlines():
        line = line.strip()
        if line.startswith("[") and "]" in line:
            token = line[1 : line.index("]")]
            try:
                declined.add(uuid.UUID(token))
            except ValueError:
                continue
    return declined


def _get_transfer_or_404(db: Session, transfer_id: uuid.UUID) -> PatientTransfer:
    transfer = db.get(PatientTransfer, transfer_id)
    if transfer is None:
        raise TransferError(404, "Transfer not found")
    return transfer


def doctor_profile_for_user(db: Session, user: User) -> Doctor | None:
    """Like app.core.ownership.get_doctor_profile, but returns None instead of
    raising for non-doctor callers — used by endpoints shared between doctor/admin."""
    if user.role != Role.doctor:
        return None
    return db.execute(select(Doctor).where(Doctor.user_id == user.id)).scalar_one_or_none()


# ---------------------------------------------------------------------------
# Initiate
# ---------------------------------------------------------------------------


def initiate_transfer(
    db: Session, *, patient: Patient, doctor: Doctor, user: User, payload: TransferInitiate
) -> PatientTransfer:
    reason = payload.reason.strip()
    if len(reason) < MIN_REASON_LENGTH:
        raise TransferError(400, f"Transfer reason must be at least {MIN_REASON_LENGTH} characters")

    has_note = db.execute(
        select(ExaminationNote.id).where(ExaminationNote.patient_id == patient.id).limit(1)
    ).first()
    if not has_note:
        raise TransferError(400, "Patient must have at least one examination note before transfer")

    has_active_transfer = db.execute(
        select(PatientTransfer.id).where(
            PatientTransfer.patient_id == patient.id,
            PatientTransfer.status.in_([TransferStatus.pending, TransferStatus.accepted]),
        ).limit(1)
    ).first()
    if has_active_transfer:
        raise TransferError(409, "Patient already has an active transfer in progress")

    if patient.department_id is None:
        raise TransferError(400, "Patient has no department assigned; cannot initiate transfer")

    if payload.transfer_type == TransferType.internal:
        if payload.to_dept_id is None:
            raise TransferError(400, "to_dept_id is required for an internal transfer")

        # No circular transfers: if the patient has a prior completed/accepted transfer
        # whose from_dept_id equals the new target department, block it (Dept A -> Dept B,
        # Dept B cannot transfer back to Dept A). Admin override doesn't apply on this
        # endpoint since it's doctor-only (require_own_patient_as_doctor above).
        circular = db.execute(
            select(PatientTransfer.id).where(
                PatientTransfer.patient_id == patient.id,
                PatientTransfer.status.in_([TransferStatus.completed, TransferStatus.accepted]),
                PatientTransfer.from_dept_id == payload.to_dept_id,
            ).limit(1)
        ).first()
        if circular:
            raise TransferError(409, "Circular transfer not allowed: patient previously came from this department")

        to_doctor = _auto_assign_doctor(db, payload.to_dept_id)
        if to_doctor is None:
            raise TransferError(409, "No doctor is currently available in the target department")

        transfer = PatientTransfer(
            patient_id=patient.id,
            from_doctor_id=doctor.id,
            from_dept_id=patient.department_id,
            transfer_type=TransferType.internal,
            to_dept_id=payload.to_dept_id,
            to_doctor_id=to_doctor.id,
            urgency=payload.urgency or Urgency.routine,
            transfer_reason=reason,
            handover_notes=payload.handover_notes,
            status=TransferStatus.pending,
        )
        db.add(transfer)
        db.flush()
        record_audit(
            db,
            user_id=user.id,
            action="create",
            entity="patient_transfers",
            entity_id=transfer.id,
            new_value={"transfer_type": "internal", "to_dept_id": str(payload.to_dept_id), "to_doctor_id": str(to_doctor.id)},
        )
        db.commit()
        db.refresh(transfer)

        to_user = doctor_user(db, to_doctor.id)
        if to_user:
            notify_user(
                db,
                user_id=to_user.id,
                title="New patient transfer request",
                body=reason,
                data={"transfer_id": str(transfer.id)},
            )
        return transfer

    # external
    if not payload.to_hospital_name:
        raise TransferError(400, "to_hospital_name is required for an external transfer")

    urgency = payload.urgency or Urgency.routine
    transfer = PatientTransfer(
        patient_id=patient.id,
        from_doctor_id=doctor.id,
        from_dept_id=patient.department_id,
        transfer_type=TransferType.external,
        to_hospital_name=payload.to_hospital_name,
        to_hospital_contact=payload.to_hospital_contact,
        urgency=urgency,
        transfer_reason=reason,
        handover_notes=payload.handover_notes,
        status=TransferStatus.pending,
    )
    db.add(transfer)
    db.flush()
    record_audit(
        db,
        user_id=user.id,
        action="create",
        entity="patient_transfers",
        entity_id=transfer.id,
        new_value={"transfer_type": "external", "to_hospital_name": payload.to_hospital_name, "urgency": urgency.value},
    )
    db.commit()
    db.refresh(transfer)

    if urgency == Urgency.emergency:
        # Spec: "Emergency urgency - skip Admin approval, generate summary in parallel."
        # status stays pending (no admin-approval gate is enforced for it later at
        # /complete), but we don't block this request on an admin action.
        _ensure_discharge_summary(db, transfer, user_id=user.id)
        db.commit()
        db.refresh(transfer)
    else:
        for admin_user in _admin_users(db):
            notify_user(
                db,
                user_id=admin_user.id,
                title="External transfer approval needed",
                body=reason,
                data={"transfer_id": str(transfer.id)},
            )
    return transfer


# ---------------------------------------------------------------------------
# Accept / decline
# ---------------------------------------------------------------------------


def accept_transfer(db: Session, *, transfer_id: uuid.UUID, doctor: Doctor, user: User) -> PatientTransfer:
    transfer = _get_transfer_or_404(db, transfer_id)
    if transfer.to_doctor_id != doctor.id:
        raise TransferError(403, "Only the receiving doctor can accept this transfer")
    if transfer.status != TransferStatus.pending:
        raise TransferError(409, f"Transfer is not pending (status={transfer.status.value})")

    old_status = transfer.status
    transfer.status = TransferStatus.accepted
    transfer.accepted_at = utcnow()

    # Ownership transfer. The original doctor keeps READ-ONLY access per spec, which
    # requires no schema change here: since patient.doctor_id now points at the
    # receiving doctor, the original doctor's GET /api/doctor/patients (scoped to
    # doctor_id == caller) will simply no longer list this patient for *editing* —
    # that is the correct "no longer theirs to write to" behavior. A read-only view
    # for the original doctor (e.g. via patient_transfers.from_doctor_id == me) is a
    # UI-layer concern for the doctor-module agent, not something this endpoint needs
    # to special-case.
    patient = db.get(Patient, transfer.patient_id)
    if patient is not None:
        patient.doctor_id = transfer.to_doctor_id
        patient.department_id = transfer.to_dept_id

    record_audit(
        db,
        user_id=user.id,
        action="update",
        entity="patient_transfers",
        entity_id=transfer.id,
        old_value={"status": old_status.value},
        new_value={"status": transfer.status.value},
    )
    db.commit()
    db.refresh(transfer)
    return transfer


def decline_transfer(db: Session, *, transfer_id: uuid.UUID, doctor: Doctor, user: User, reason: str) -> PatientTransfer:
    transfer = _get_transfer_or_404(db, transfer_id)
    if transfer.to_doctor_id != doctor.id:
        raise TransferError(403, "Only the receiving doctor can decline this transfer")
    if transfer.status != TransferStatus.pending:
        raise TransferError(409, f"Transfer is not pending (status={transfer.status.value})")

    reason = reason.strip()
    if not reason:
        raise TransferError(400, "A decline reason is required")

    entry = f"[{doctor.id}] {reason}"
    transfer.decline_reason = f"{transfer.decline_reason}\n{entry}" if transfer.decline_reason else entry
    transfer.decline_count += 1

    declined_ids = _parse_declined_doctor_ids(transfer.decline_reason)
    next_doctor = _auto_assign_doctor(db, transfer.to_dept_id, exclude_doctor_ids=declined_ids)
    transfer.to_doctor_id = next_doctor.id if next_doctor else None

    escalate = transfer.decline_count >= DECLINE_ESCALATION_THRESHOLD

    record_audit(
        db,
        user_id=user.id,
        action="update",
        entity="patient_transfers",
        entity_id=transfer.id,
        old_value={"decline_count": transfer.decline_count - 1},
        new_value={"decline_count": transfer.decline_count, "to_doctor_id": str(transfer.to_doctor_id) if transfer.to_doctor_id else None},
    )
    db.commit()
    db.refresh(transfer)

    if next_doctor:
        new_user = doctor_user(db, next_doctor.id)
        if new_user:
            notify_user(
                db,
                user_id=new_user.id,
                title="Patient transfer request (reassigned)",
                body=transfer.transfer_reason,
                data={"transfer_id": str(transfer.id)},
            )

    if escalate:
        # Spec rule: "After 3 declines -> Admin auto-alerted."
        for admin_user in _admin_users(db):
            notify_user(
                db,
                user_id=admin_user.id,
                title="Transfer declined 3 times",
                body=f"Transfer {transfer.id} has been declined {transfer.decline_count} times and needs attention.",
                data={"transfer_id": str(transfer.id)},
            )

    return transfer


# ---------------------------------------------------------------------------
# Admin approve
# ---------------------------------------------------------------------------


def approve_transfer(db: Session, *, transfer_id: uuid.UUID, user: User) -> PatientTransfer:
    transfer = _get_transfer_or_404(db, transfer_id)
    if transfer.transfer_type != TransferType.external:
        raise TransferError(400, "Only external transfers require admin approval")
    if transfer.status != TransferStatus.pending:
        raise TransferError(409, f"Transfer is not pending (status={transfer.status.value})")

    transfer.admin_approved_by = user.id
    _ensure_discharge_summary(db, transfer, user_id=user.id)
    record_audit(
        db,
        user_id=user.id,
        action="update",
        entity="patient_transfers",
        entity_id=transfer.id,
        new_value={"admin_approved_by": str(user.id)},
    )
    db.commit()
    db.refresh(transfer)

    from_user = doctor_user(db, transfer.from_doctor_id)
    if from_user:
        notify_user(
            db,
            user_id=from_user.id,
            title="External transfer approved",
            body="Admin approved the external transfer; arrange transport.",
            data={"transfer_id": str(transfer.id)},
        )
    return transfer


# ---------------------------------------------------------------------------
# Complete
# ---------------------------------------------------------------------------


def complete_transfer(db: Session, *, transfer_id: uuid.UUID, user: User, actor_doctor: Doctor | None) -> PatientTransfer:
    transfer = _get_transfer_or_404(db, transfer_id)

    if user.role == Role.doctor:
        if actor_doctor is None or transfer.from_doctor_id != actor_doctor.id:
            raise TransferError(403, "Only the referring doctor or an admin can complete this transfer")
    elif user.role != Role.admin:
        raise TransferError(403, "Not permitted to complete transfers")

    if transfer.transfer_type == TransferType.internal:
        if transfer.status != TransferStatus.accepted:
            raise TransferError(409, "Internal transfer must be accepted by the receiving doctor before it can be completed")
    else:
        if transfer.status != TransferStatus.pending:
            raise TransferError(409, f"Transfer is not in a completable state (status={transfer.status.value})")
        if transfer.urgency != Urgency.emergency and transfer.admin_approved_by is None:
            raise TransferError(409, "External transfer requires admin approval before completion")

    old_status = transfer.status
    transfer.status = TransferStatus.completed
    transfer.completed_at = utcnow()

    if transfer.transfer_type == TransferType.external:
        patient = db.get(Patient, transfer.patient_id)
        if patient is not None:
            patient.profile_status = ProfileStatus.discharged
            patient.discharged_at = utcnow()

    record_audit(
        db,
        user_id=user.id,
        action="update",
        entity="patient_transfers",
        entity_id=transfer.id,
        old_value={"status": old_status.value},
        new_value={"status": transfer.status.value},
    )
    db.commit()
    db.refresh(transfer)
    return transfer


# ---------------------------------------------------------------------------
# Cancel (spec: "cannot be deleted, only cancelled with a reason")
# ---------------------------------------------------------------------------


def cancel_transfer(db: Session, *, transfer_id: uuid.UUID, user: User, actor_doctor: Doctor | None, reason: str) -> PatientTransfer:
    transfer = _get_transfer_or_404(db, transfer_id)

    reason = reason.strip()
    if not reason:
        raise TransferError(400, "A cancellation reason is required")

    if user.role == Role.doctor:
        if actor_doctor is None or transfer.from_doctor_id != actor_doctor.id:
            raise TransferError(403, "Only the referring doctor or an admin can cancel this transfer")
    elif user.role != Role.admin:
        raise TransferError(403, "Not permitted to cancel transfers")

    if transfer.status in (TransferStatus.completed, TransferStatus.cancelled):
        raise TransferError(409, f"Transfer is already {transfer.status.value}, cannot cancel")

    old_status = transfer.status
    # decline_reason doubles as the general append-only reason log for this model
    # (see _parse_declined_doctor_ids) since there is no dedicated cancel_reason
    # column; entries are tagged so they don't get mistaken for doctor declines.
    entry = f"[cancelled by {user.id}] {reason}"
    transfer.decline_reason = f"{transfer.decline_reason}\n{entry}" if transfer.decline_reason else entry
    transfer.status = TransferStatus.cancelled

    record_audit(
        db,
        user_id=user.id,
        action="cancel",
        entity="patient_transfers",
        entity_id=transfer.id,
        old_value={"status": old_status.value},
        new_value={"status": transfer.status.value, "cancel_reason": reason},
    )
    db.commit()
    db.refresh(transfer)
    return transfer


# ---------------------------------------------------------------------------
# Discharge summary
# ---------------------------------------------------------------------------


def generate_summary(db: Session, *, transfer_id: uuid.UUID, user: User, actor_doctor: Doctor | None) -> PatientTransfer:
    transfer = _get_transfer_or_404(db, transfer_id)

    if user.role == Role.doctor:
        if actor_doctor is None or actor_doctor.id not in (transfer.from_doctor_id, transfer.to_doctor_id):
            raise TransferError(403, "Not permitted to generate a summary for this transfer")
    elif user.role != Role.admin:
        raise TransferError(403, "Not permitted to generate transfer summaries")

    _ensure_discharge_summary(db, transfer, user_id=user.id)
    db.commit()
    db.refresh(transfer)
    return transfer


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


def list_patient_transfers(db: Session, *, patient_id: uuid.UUID) -> list[PatientTransfer]:
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise TransferError(404, "Patient not found")
    return list(
        db.execute(
            select(PatientTransfer)
            .where(PatientTransfer.patient_id == patient_id)
            .order_by(PatientTransfer.initiated_at.desc())
        ).scalars()
    )


def list_incoming_for_doctor(db: Session, *, doctor_id: uuid.UUID) -> list[PatientTransfer]:
    return list(
        db.execute(
            select(PatientTransfer)
            .where(PatientTransfer.to_doctor_id == doctor_id, PatientTransfer.status == TransferStatus.pending)
            .order_by(PatientTransfer.initiated_at.desc())
        ).scalars()
    )


def list_pending_external(db: Session) -> list[PatientTransfer]:
    return list(
        db.execute(
            select(PatientTransfer)
            .where(PatientTransfer.transfer_type == TransferType.external, PatientTransfer.status == TransferStatus.pending)
            .order_by(PatientTransfer.initiated_at.desc())
        ).scalars()
    )


def list_escalated(db: Session) -> list[PatientTransfer]:
    return list(
        db.execute(
            select(PatientTransfer)
            .where(PatientTransfer.decline_count >= DECLINE_ESCALATION_THRESHOLD)
            .order_by(PatientTransfer.initiated_at.desc())
        ).scalars()
    )
