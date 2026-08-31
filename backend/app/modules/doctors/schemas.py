import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.doctors.models import Frequency, Route
from app.modules.labs.models import TestOrderStatus
from app.modules.patients.models import AdmissionType, Gender, ProfileStatus


# ---------------------------------------------------------------------------
# Patients (doctor's own list)
# ---------------------------------------------------------------------------


class DoctorPatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    date_of_birth: date
    gender: Gender
    admission_type: AdmissionType
    profile_status: ProfileStatus
    ward: str | None = None
    admitted_at: datetime | None = None
    # Latest examination-note timestamp for this patient, used by the frontend as
    # a cheap "last visit" column without a second round trip per patient.
    last_note_at: datetime | None = None


class DoctorPatientListOut(BaseModel):
    patients: list[DoctorPatientOut]
    # Count of this doctor's TestOrders sitting at status=completed (i.e. awaiting
    # PATCH /api/tests/{id}/review). Bundled here so the dashboard's "Pending
    # Reports" stat card doesn't need a dedicated endpoint (see task notes).
    pending_reports_count: int


# ---------------------------------------------------------------------------
# Examination notes
# ---------------------------------------------------------------------------


class NoteCreate(BaseModel):
    note_text: str = Field(min_length=1)


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    note_text: str
    created_at: datetime


# ---------------------------------------------------------------------------
# Test orders
# ---------------------------------------------------------------------------


class TestOrderCreate(BaseModel):
    test_type_id: uuid.UUID
    notes: str | None = None


class TestOrderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    test_type_id: uuid.UUID
    status: TestOrderStatus
    ordered_at: datetime
    result_text: str | None = None
    result_file_url: str | None = None
    completed_at: datetime | None = None
    reviewed_at: datetime | None = None
    notes: str | None = None


# ---------------------------------------------------------------------------
# Prescriptions
# ---------------------------------------------------------------------------


class PrescriptionLineCreate(BaseModel):
    medicine_name: str = Field(min_length=1, max_length=120)
    dosage: str = Field(min_length=1, max_length=40)
    route: Route
    frequency: Frequency
    start_date: date
    duration_days: int = Field(gt=0)
    with_food: bool = False
    special_instructions: str | None = None


class PrescriptionLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    medicine_name: str
    dosage: str
    route: Route
    frequency: Frequency
    start_date: date
    duration_days: int
    with_food: bool
    special_instructions: str | None = None


class PrescriptionCreate(BaseModel):
    notes: str | None = None
    lines: list[PrescriptionLineCreate] = Field(min_length=1)


class PrescriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    version: int
    is_active: bool
    notes: str | None = None
    created_at: datetime
    archived_at: datetime | None = None
    lines: list[PrescriptionLineOut] = []


# ---------------------------------------------------------------------------
# Discharge
# ---------------------------------------------------------------------------


class DischargeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    profile_status: ProfileStatus
    discharged_at: datetime | None = None
    cancelled_alert_count: int
