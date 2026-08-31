import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.roles import Role
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.doctors.models import Doctor
from app.modules.patients.models import Patient


def require_own_patient_as_doctor(patient_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Patient:
    """Doctor endpoints: patient must exist and be assigned to the calling doctor.
    Spec security rule #2 — 'also check that the patient is assigned to this doctor'."""
    if user.role != Role.doctor:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Doctor role required")
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    doctor = db.execute(select(Doctor).where(Doctor.user_id == user.id)).scalar_one_or_none()
    if doctor is None or patient.doctor_id != doctor.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Patient is not assigned to you")
    return patient


def require_own_patient_as_nurse(patient_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Patient:
    """Nurse endpoints: patient must be in the calling nurse's ward.
    Spec security rule #3 — 'also check that the patient is in this nurse's ward'."""
    if user.role != Role.head_nurse:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Head nurse role required")
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Patient not found")
    if not user.ward or patient.ward != user.ward:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Patient is not in your ward")
    return patient


def get_doctor_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Doctor:
    if user.role != Role.doctor:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Doctor role required")
    doctor = db.execute(select(Doctor).where(Doctor.user_id == user.id)).scalar_one_or_none()
    if doctor is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Doctor profile not found for this user")
    return doctor
