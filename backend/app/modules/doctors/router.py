import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.ownership import get_doctor_profile, require_own_patient_as_doctor
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.doctors import service
from app.modules.doctors.models import Doctor
from app.modules.doctors.schemas import (
    DischargeOut,
    DoctorPatientListOut,
    DoctorPatientOut,
    NoteCreate,
    NoteOut,
    PrescriptionCreate,
    PrescriptionOut,
    TestOrderCreate,
    TestOrderOut,
)
from app.modules.patients.models import Patient

router = APIRouter(prefix="/api", tags=["doctor"])


@router.get("/doctor/patients", response_model=DoctorPatientListOut)
def get_doctor_patients(
    doctor: Doctor = Depends(get_doctor_profile),
    db: Session = Depends(get_db),
):
    patients, last_note_map, pending_reports_count = service.list_doctor_patients(db, doctor)
    items = [
        DoctorPatientOut(
            id=p.id,
            full_name=p.full_name,
            date_of_birth=p.date_of_birth,
            gender=p.gender,
            admission_type=p.admission_type,
            profile_status=p.profile_status,
            ward=p.ward,
            admitted_at=p.admitted_at,
            last_note_at=last_note_map.get(p.id),
        )
        for p in patients
    ]
    return DoctorPatientListOut(patients=items, pending_reports_count=pending_reports_count)


@router.post("/patients/{patient_id}/notes", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
def add_examination_note(
    payload: NoteCreate,
    patient: Patient = Depends(require_own_patient_as_doctor),
    doctor: Doctor = Depends(get_doctor_profile),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_note(db, patient=patient, doctor=doctor, user=user, note_text=payload.note_text)


@router.get("/patients/{patient_id}/notes", response_model=list[NoteOut])
def get_examination_notes(
    patient: Patient = Depends(require_own_patient_as_doctor),
    db: Session = Depends(get_db),
):
    return service.list_notes(db, patient_id=patient.id)


@router.post("/patients/{patient_id}/tests", response_model=TestOrderOut, status_code=status.HTTP_201_CREATED)
def order_test(
    payload: TestOrderCreate,
    patient: Patient = Depends(require_own_patient_as_doctor),
    doctor: Doctor = Depends(get_doctor_profile),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.create_test_order(
            db, patient=patient, doctor=doctor, user=user, test_type_id=payload.test_type_id, notes=payload.notes
        )
    except service.DoctorServiceError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.patch("/tests/{test_order_id}/review", response_model=TestOrderOut)
def review_test(
    test_order_id: uuid.UUID,
    doctor: Doctor = Depends(get_doctor_profile),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return service.review_test_order(db, test_order_id=test_order_id, doctor=doctor, user=user)
    except service.DoctorServiceError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.post(
    "/patients/{patient_id}/prescriptions", response_model=PrescriptionOut, status_code=status.HTTP_201_CREATED
)
def create_or_revise_prescription(
    payload: PrescriptionCreate,
    patient: Patient = Depends(require_own_patient_as_doctor),
    doctor: Doctor = Depends(get_doctor_profile),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return service.create_or_revise_prescription(db, patient=patient, doctor=doctor, user=user, payload=payload)


@router.get("/patients/{patient_id}/prescriptions", response_model=list[PrescriptionOut])
def get_prescriptions(
    patient: Patient = Depends(require_own_patient_as_doctor),
    db: Session = Depends(get_db),
):
    return service.list_prescriptions(db, patient_id=patient.id)


@router.patch("/patients/{patient_id}/discharge", response_model=DischargeOut)
def discharge_patient(
    patient: Patient = Depends(require_own_patient_as_doctor),
    doctor: Doctor = Depends(get_doctor_profile),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        updated, cancelled_count = service.discharge_patient(db, patient=patient, doctor=doctor, user=user)
    except service.DoctorServiceError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return DischargeOut(
        id=updated.id,
        profile_status=updated.profile_status,
        discharged_at=updated.discharged_at,
        cancelled_alert_count=cancelled_count,
    )
