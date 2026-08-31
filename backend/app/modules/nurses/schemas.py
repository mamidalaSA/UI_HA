import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict

from app.modules.alerts.models import AlertStatus
from app.modules.doctors.models import Route


class NurseAlertOut(BaseModel):
    """One row for GET /api/nurse/alerts — an Alert joined with patient + prescription
    line details so the nurse dashboard can render everything without extra round-trips."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    ward: str | None
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
    acknowledged_at: datetime | None


class AlertAcknowledgeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: AlertStatus
    acknowledged_at: datetime | None


class MedicationLogCreate(BaseModel):
    # skip_reason is required when skipped=true, but that check is deliberately NOT done
    # here — a pydantic validator failure returns 422, while the spec requires a 400
    # response for this rule. Enforced instead in service.log_dose().
    dose_given: str | None = None
    route_used: Route | None = None
    skipped: bool = False
    skip_reason: str | None = None
    notes: str | None = None


class MedicationLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    alert_id: uuid.UUID
    prescription_line_id: uuid.UUID
    patient_id: uuid.UUID
    administered_by: uuid.UUID
    administered_at: datetime
    dose_given: str | None
    route_used: Route | None
    skipped: bool
    skip_reason: str | None
    notes: str | None


class VitalsCreate(BaseModel):
    temperature_c: float | None = None
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    pulse_bpm: int | None = None
    spo2_pct: int | None = None
    resp_rate: int | None = None
    blood_glucose: float | None = None
    gcs_score: int | None = None


class VitalsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    recorded_by: uuid.UUID
    recorded_at: datetime
    temperature_c: float | None
    bp_systolic: int | None
    bp_diastolic: int | None
    pulse_bpm: int | None
    spo2_pct: int | None
    resp_rate: int | None
    blood_glucose: float | None
    gcs_score: int | None
    flagged: bool
    flag_reason: str | None


class EscalationCreate(BaseModel):
    patient_id: uuid.UUID
    message: str


class EscalationOut(BaseModel):
    sent: bool
    patient_id: uuid.UUID
    doctor_user_id: uuid.UUID | None
