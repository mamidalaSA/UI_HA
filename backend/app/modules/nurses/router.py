import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.core.ownership import require_own_patient_as_nurse
from app.core.roles import Role
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.nurses import service
from app.modules.nurses.schemas import (
    AlertAcknowledgeOut,
    EscalationCreate,
    EscalationOut,
    MedicationLogCreate,
    MedicationLogOut,
    NurseAlertOut,
    VitalsCreate,
    VitalsOut,
)
from app.modules.patients.models import Patient

router = APIRouter(prefix="/api", tags=["nurse"])


def _raise_for(exc: service.NurseServiceError) -> None:
    if isinstance(exc, service.NotFoundError):
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    if isinstance(exc, service.ForbiddenError):
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    if isinstance(exc, service.ValidationError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("/nurse/alerts", response_model=list[NurseAlertOut])
def get_nurse_alerts(
    user: User = Depends(require_role(Role.head_nurse)),
    db: Session = Depends(get_db),
):
    return service.list_nurse_alerts(db, user=user)


@router.patch("/alerts/{alert_id}/acknowledge", response_model=AlertAcknowledgeOut)
def acknowledge_alert(
    alert_id: uuid.UUID,
    user: User = Depends(require_role(Role.head_nurse)),
    db: Session = Depends(get_db),
):
    try:
        return service.acknowledge_alert(db, user=user, alert_id=alert_id)
    except service.NurseServiceError as exc:
        _raise_for(exc)


@router.post("/alerts/{alert_id}/log", response_model=MedicationLogOut)
def log_dose(
    alert_id: uuid.UUID,
    payload: MedicationLogCreate,
    user: User = Depends(require_role(Role.head_nurse)),
    db: Session = Depends(get_db),
):
    try:
        return service.log_dose(db, user=user, alert_id=alert_id, payload=payload)
    except service.NurseServiceError as exc:
        _raise_for(exc)


@router.post("/patients/{patient_id}/vitals", response_model=VitalsOut)
def record_vitals(
    payload: VitalsCreate,
    patient: Patient = Depends(require_own_patient_as_nurse),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.record_vitals(db, user=user, patient=patient, payload=payload)


@router.get("/patients/{patient_id}/vitals", response_model=list[VitalsOut])
def get_vitals(
    patient: Patient = Depends(require_own_patient_as_nurse),
    db: Session = Depends(get_db),
):
    return service.list_vitals(db, patient=patient)


@router.get("/patients/{patient_id}/medication-log", response_model=list[MedicationLogOut])
def get_medication_log(
    patient: Patient = Depends(require_own_patient_as_nurse),
    db: Session = Depends(get_db),
):
    return service.list_medication_log(db, patient=patient)


@router.post("/escalations", response_model=EscalationOut)
def create_escalation(
    payload: EscalationCreate,
    user: User = Depends(require_role(Role.head_nurse)),
    db: Session = Depends(get_db),
):
    try:
        doc_user = service.escalate(db, user=user, payload=payload)
    except service.NurseServiceError as exc:
        _raise_for(exc)
    return EscalationOut(sent=doc_user is not None, patient_id=payload.patient_id, doctor_user_id=doc_user.id if doc_user else None)
