import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.core.ownership import get_doctor_profile, require_own_patient_as_doctor
from app.core.roles import Role
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.doctors.models import Doctor
from app.modules.patients.models import Patient
from app.modules.transfers import service
from app.modules.transfers.schemas import (
    TransferCancelRequest,
    TransferDeclineRequest,
    TransferInitiate,
    TransferListOut,
    TransferOut,
    TransferSummaryOut,
)

router = APIRouter(prefix="/api", tags=["transfers"])

# Any staff role except `patient` may read transfer history (GET /patients/{id}/transfers).
STAFF_ROLES = (Role.admin, Role.receptionist, Role.doctor, Role.head_nurse, Role.lab_staff, Role.pharmacist)


def _optional_doctor_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Doctor | None:
    """Like get_doctor_profile, but returns None instead of 403/404 for non-doctor
    callers, for endpoints shared between the doctor and admin roles."""
    return service.doctor_profile_for_user(db, user)


def _raise(exc: service.TransferError):
    raise HTTPException(exc.status_code, exc.message) from exc


# ---------------------------------------------------------------------------
# Initiate
# ---------------------------------------------------------------------------


@router.post("/patients/{patient_id}/transfer", response_model=TransferOut, status_code=status.HTTP_201_CREATED)
def initiate_transfer(
    patient_id: uuid.UUID,
    payload: TransferInitiate,
    patient: Patient = Depends(require_own_patient_as_doctor),
    doctor: Doctor = Depends(get_doctor_profile),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.initiate_transfer(db, patient=patient, doctor=doctor, user=user, payload=payload)
    except service.TransferError as exc:
        _raise(exc)


# ---------------------------------------------------------------------------
# Accept / decline
# ---------------------------------------------------------------------------


@router.patch("/transfers/{transfer_id}/accept", response_model=TransferOut)
def accept_transfer(
    transfer_id: uuid.UUID,
    doctor: Doctor = Depends(get_doctor_profile),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.accept_transfer(db, transfer_id=transfer_id, doctor=doctor, user=user)
    except service.TransferError as exc:
        _raise(exc)


@router.patch("/transfers/{transfer_id}/decline", response_model=TransferOut)
def decline_transfer(
    transfer_id: uuid.UUID,
    payload: TransferDeclineRequest,
    doctor: Doctor = Depends(get_doctor_profile),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.decline_transfer(db, transfer_id=transfer_id, doctor=doctor, user=user, reason=payload.reason)
    except service.TransferError as exc:
        _raise(exc)


# ---------------------------------------------------------------------------
# Admin approve
# ---------------------------------------------------------------------------


@router.patch("/transfers/{transfer_id}/approve", response_model=TransferOut)
def approve_transfer(
    transfer_id: uuid.UUID,
    user: User = Depends(require_role(Role.admin)),
    db: Session = Depends(get_db),
):
    try:
        return service.approve_transfer(db, transfer_id=transfer_id, user=user)
    except service.TransferError as exc:
        _raise(exc)


# ---------------------------------------------------------------------------
# Complete / cancel (doctor-from or admin)
# ---------------------------------------------------------------------------


@router.patch("/transfers/{transfer_id}/complete", response_model=TransferOut)
def complete_transfer(
    transfer_id: uuid.UUID,
    user: User = Depends(require_role(Role.doctor, Role.admin)),
    actor_doctor: Doctor | None = Depends(_optional_doctor_profile),
    db: Session = Depends(get_db),
):
    try:
        return service.complete_transfer(db, transfer_id=transfer_id, user=user, actor_doctor=actor_doctor)
    except service.TransferError as exc:
        _raise(exc)


@router.patch("/transfers/{transfer_id}/cancel", response_model=TransferOut)
def cancel_transfer(
    transfer_id: uuid.UUID,
    payload: TransferCancelRequest,
    user: User = Depends(require_role(Role.doctor, Role.admin)),
    actor_doctor: Doctor | None = Depends(_optional_doctor_profile),
    db: Session = Depends(get_db),
):
    try:
        return service.cancel_transfer(db, transfer_id=transfer_id, user=user, actor_doctor=actor_doctor, reason=payload.reason)
    except service.TransferError as exc:
        _raise(exc)


# ---------------------------------------------------------------------------
# Discharge summary
# ---------------------------------------------------------------------------


@router.post("/transfers/{transfer_id}/summary", response_model=TransferSummaryOut)
def generate_summary(
    transfer_id: uuid.UUID,
    user: User = Depends(require_role(Role.doctor, Role.admin)),
    actor_doctor: Doctor | None = Depends(_optional_doctor_profile),
    db: Session = Depends(get_db),
):
    try:
        transfer = service.generate_summary(db, transfer_id=transfer_id, user=user, actor_doctor=actor_doctor)
    except service.TransferError as exc:
        _raise(exc)
    return TransferSummaryOut(id=transfer.id, discharge_summary_url=transfer.discharge_summary_url)


# ---------------------------------------------------------------------------
# Reads
# ---------------------------------------------------------------------------


@router.get("/patients/{patient_id}/transfers", response_model=TransferListOut)
def list_patient_transfers(
    patient_id: uuid.UUID,
    user: User = Depends(require_role(*STAFF_ROLES)),
    db: Session = Depends(get_db),
):
    try:
        transfers = service.list_patient_transfers(db, patient_id=patient_id)
    except service.TransferError as exc:
        _raise(exc)
    return TransferListOut(transfers=transfers)


# Pragmatic addition (not in the spec's literal endpoint list): the doctor UI needs a
# way to discover incoming transfer requests addressed to the logged-in doctor.
@router.get("/doctor/transfers/incoming", response_model=TransferListOut)
def incoming_transfers(
    doctor: Doctor = Depends(get_doctor_profile),
    db: Session = Depends(get_db),
):
    return TransferListOut(transfers=service.list_incoming_for_doctor(db, doctor_id=doctor.id))


# Pragmatic addition: admin approval queue for external transfers.
@router.get("/admin/transfers/pending-external", response_model=TransferListOut)
def pending_external_transfers(
    user: User = Depends(require_role(Role.admin)),
    db: Session = Depends(get_db),
):
    return TransferListOut(transfers=service.list_pending_external(db))


# Pragmatic addition: admin escalation queue (decline_count >= 3).
@router.get("/admin/transfers/escalated", response_model=TransferListOut)
def escalated_transfers(
    user: User = Depends(require_role(Role.admin)),
    db: Session = Depends(get_db),
):
    return TransferListOut(transfers=service.list_escalated(db))
