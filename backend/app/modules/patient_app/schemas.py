import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict

from app.core.roles import Role
from app.modules.alerts.models import AlertStatus
from app.modules.doctors.models import Frequency, Route


class PatientRegisterRequest(BaseModel):
    patient_id: uuid.UUID
    mobile: str
    otp_code: str


class PatientRegisterResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: Role
    user_id: uuid.UUID
    patient_id: uuid.UUID
    full_name: str


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
    special_instructions: str | None


class ActivePrescriptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    version: int
    notes: str | None
    created_at: datetime
    lines: list[PrescriptionLineOut] = []


class PatientAlertOut(BaseModel):
    """One row for GET /api/patient/alerts/today — an Alert joined with its
    prescription line so the mobile app can render the dose card in one round-trip."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    prescription_line_id: uuid.UUID
    medicine_name: str
    dosage: str
    route: Route
    with_food: bool
    special_instructions: str | None
    scheduled_date: date
    slot_time: time
    fire_at: datetime
    expire_at: datetime
    status: AlertStatus


class AlertTakenOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: AlertStatus


class MedicationHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alert_id: uuid.UUID
    prescription_line_id: uuid.UUID
    medicine_name: str | None = None
    administered_at: datetime
    dose_given: str | None
    route_used: Route | None
    skipped: bool
    skip_reason: str | None
    notes: str | None
