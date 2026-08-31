import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.deps import get_current_user, require_role
from app.core.roles import Role
from app.db.session import get_db
from app.integrations.payments import get_payment_provider
from app.modules.auth.models import User
from app.modules.doctors.models import Doctor
from app.modules.patients import service
from app.modules.patients.models import Patient, ProfileStatus
from app.modules.patients.schemas import (
    ActivateRequest,
    AssignRequest,
    ConfirmRequest,
    PatientCreate,
    PatientListOut,
    PatientOut,
    PaymentInitiateRequest,
    PaymentOfflineRequest,
)

router = APIRouter(prefix="/api", tags=["reception"])

reception_role = require_role(Role.receptionist, Role.admin)


def _raise(exc: service.PatientError):
    raise HTTPException(exc.status_code, str(exc)) from exc


def _get_patient_or_404(db: Session, patient_id: uuid.UUID) -> Patient:
    patient = service.get_patient(db, patient_id)
    if patient is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    return patient


def _get_patient_for_view(
    patient_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Patient:
    """GET /api/patients/{id}: receptionist, admin, or the assigned doctor."""
    patient = _get_patient_or_404(db, patient_id)
    if user.role in (Role.receptionist, Role.admin):
        return patient
    if user.role == Role.doctor:
        doctor = db.execute(select(Doctor).where(Doctor.user_id == user.id)).scalar_one_or_none()
        if doctor is not None and patient.doctor_id == doctor.id:
            return patient
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Not permitted to view this patient")


@router.post("/patients", response_model=PatientOut, status_code=status.HTTP_201_CREATED)
def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    user: User = Depends(reception_role),
):
    try:
        patient = service.create_patient(db, payload, current_user=user)
    except service.PatientError as exc:
        _raise(exc)
    return patient


@router.get("/patients", response_model=list[PatientListOut])
def list_patients(
    status: ProfileStatus | None = Query(None),
    db: Session = Depends(get_db),
    user: User = Depends(reception_role),
):
    return service.list_patients(db, status=status)


@router.get("/patients/{patient_id}", response_model=PatientOut)
def get_patient(patient: Patient = Depends(_get_patient_for_view)):
    return patient


@router.patch("/patients/{patient_id}/activate", response_model=PatientOut)
def activate_patient(
    patient_id: uuid.UUID,
    payload: ActivateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(reception_role),
):
    patient = _get_patient_or_404(db, patient_id)
    try:
        service.activate_patient(db, patient, otp_code=payload.otp_code, current_user=user)
    except service.PatientError as exc:
        db.rollback()
        _raise(exc)
    db.commit()
    db.refresh(patient)
    return patient


@router.patch("/patients/{patient_id}/confirm", response_model=PatientOut)
def confirm_patient(
    patient_id: uuid.UUID,
    payload: ConfirmRequest,
    db: Session = Depends(get_db),
    user: User = Depends(reception_role),
):
    patient = _get_patient_or_404(db, patient_id)
    try:
        service.confirm_patient(db, patient, otp_code=payload.otp_code, updates=payload.updates, current_user=user)
    except service.PatientError as exc:
        db.rollback()
        _raise(exc)
    db.commit()
    db.refresh(patient)
    return patient


@router.post("/assign", response_model=PatientOut)
def assign_patient(
    payload: AssignRequest,
    db: Session = Depends(get_db),
    user: User = Depends(reception_role),
):
    patient = _get_patient_or_404(db, payload.patient_id)
    service.run_auto_assignment(db, patient)
    record_audit(
        db,
        user_id=user.id,
        action="assign",
        entity="patients",
        entity_id=patient.id,
        new_value={"doctor_id": str(patient.doctor_id) if patient.doctor_id else None, "department_id": str(patient.department_id) if patient.department_id else None},
    )
    db.commit()
    db.refresh(patient)
    return patient


@router.post("/payments/initiate", response_model=PatientOut)
def initiate_payment(
    payload: PaymentInitiateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(reception_role),
):
    patient = _get_patient_or_404(db, payload.patient_id)
    try:
        service.initiate_payment(db, patient, current_user=user)
    except service.PatientError as exc:
        db.rollback()
        _raise(exc)
    db.commit()
    db.refresh(patient)
    return patient


@router.post("/payments/webhook")
async def payment_webhook(request: Request, db: Session = Depends(get_db)):
    """Public payment gateway callback — no auth (per spec), but the signature is
    verified before anything is processed (security rule #9)."""
    raw_body = await request.body()
    signature = (
        request.headers.get("X-Razorpay-Signature")
        or request.headers.get("X-Signature")
        or ""
    )
    if not get_payment_provider().verify_webhook_signature(payload=raw_body, signature=signature):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid webhook signature")

    try:
        data = json.loads(raw_body or b"{}")
    except json.JSONDecodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid JSON payload")

    patient_id = data.get("patient_id")
    if not patient_id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "patient_id is required in webhook payload")

    patient = service.get_patient(db, uuid.UUID(str(patient_id)))
    if patient is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")

    service.mark_payment_paid_from_webhook(db, patient)
    db.commit()
    return {"received": True, "payment_status": patient.payment_status.value}


@router.patch("/payments/offline", response_model=PatientOut)
def record_offline_payment(
    payload: PaymentOfflineRequest,
    db: Session = Depends(get_db),
    user: User = Depends(reception_role),
):
    patient = _get_patient_or_404(db, payload.patient_id)
    service.record_offline_payment(db, patient, receipt_number=payload.receipt_number, current_user=user)
    db.commit()
    db.refresh(patient)
    return patient
