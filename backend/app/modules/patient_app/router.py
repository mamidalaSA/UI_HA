import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.core.roles import Role
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.patient_app import service
from app.modules.patient_app.schemas import (
    ActivePrescriptionOut,
    AlertTakenOut,
    MedicationHistoryOut,
    PatientAlertOut,
    PatientRegisterRequest,
    PatientRegisterResponse,
    PrescriptionLineOut,
)

router = APIRouter(prefix="/api/patient", tags=["patient_app"])


@router.post("/register", response_model=PatientRegisterResponse)
def register(payload: PatientRegisterRequest, db: Session = Depends(get_db)):
    try:
        token, user, patient = service.register(
            db, patient_id=payload.patient_id, mobile=payload.mobile, otp_code=payload.otp_code
        )
    except service.NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except service.PatientAppError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return PatientRegisterResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        patient_id=patient.id,
        full_name=user.full_name,
    )


@router.get("/prescriptions/active", response_model=ActivePrescriptionOut)
def active_prescription(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.patient)),
):
    try:
        prescription, lines = service.get_active_prescription(db, user=user)
    except service.NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return ActivePrescriptionOut(
        id=prescription.id,
        patient_id=prescription.patient_id,
        doctor_id=prescription.doctor_id,
        version=prescription.version,
        notes=prescription.notes,
        created_at=prescription.created_at,
        lines=[PrescriptionLineOut.model_validate(line) for line in lines],
    )


@router.get("/alerts/today", response_model=list[PatientAlertOut])
def alerts_today(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.patient)),
):
    try:
        return service.get_alerts_today(db, user=user)
    except service.NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.patch("/alerts/{alert_id}/taken", response_model=AlertTakenOut)
def mark_taken(
    alert_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.patient)),
):
    try:
        alert = service.mark_taken(db, alert_id=alert_id, user=user)
    except service.NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except service.PatientAppError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return alert


@router.get("/history", response_model=list[MedicationHistoryOut])
def history(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.patient)),
):
    try:
        return service.get_history(db, user=user)
    except service.NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
