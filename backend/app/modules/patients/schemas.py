import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.modules.patients.models import (
    AdmissionType,
    Gender,
    IntakeChannel,
    PaymentMethod,
    PaymentStatus,
    ProfileStatus,
)


class PatientCreate(BaseModel):
    """Payload for POST /api/patients.

    `intake_channel` drives what happens next (see service.create_patient):
    emergency -> active immediately, phone -> draft, website -> pending.
    """

    full_name: str
    date_of_birth: date
    gender: Gender
    id_number: str
    blood_group: str | None = None
    mobile: str
    email: str | None = None
    address: str | None = None
    emergency_name: str
    emergency_phone: str

    intake_channel: IntakeChannel
    admission_type: AdmissionType
    chief_complaint: str

    medico_legal: bool = False
    fir_number: str | None = None

    # Emergency-only: if true, payment_status is set to `deferred` instead of
    # kicking off the online payment flow (spec: "Payment can be deferred").
    defer_payment: bool = False

    @model_validator(mode="after")
    def _validate_fir(self) -> "PatientCreate":
        if self.medico_legal and not self.fir_number:
            raise ValueError("fir_number is required when medico_legal is true")
        if not self.medico_legal and self.fir_number:
            raise ValueError("fir_number can only be set when medico_legal is true")
        return self


class PatientUpdate(BaseModel):
    """Partial update payload accepted by PATCH /api/patients/{id}/confirm.
    Every field is optional; only provided fields are applied. fir_number is
    write-once — rejected if the patient already has one set (security rule #7).
    """

    full_name: str | None = None
    date_of_birth: date | None = None
    gender: Gender | None = None
    id_number: str | None = None
    blood_group: str | None = None
    mobile: str | None = None
    email: str | None = None
    address: str | None = None
    emergency_name: str | None = None
    emergency_phone: str | None = None

    admission_type: AdmissionType | None = None
    chief_complaint: str | None = None

    medico_legal: bool | None = None
    fir_number: str | None = None

    # Receptionist override of auto-assignment.
    doctor_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    consult_fee: float | None = None


class ActivateRequest(BaseModel):
    """PATCH /api/patients/{id}/activate body. otp_code is required unless the
    patient's mobile is already verified."""

    otp_code: str | None = None


class ConfirmRequest(BaseModel):
    """PATCH /api/patients/{id}/confirm body: optional edits + otp_code."""

    otp_code: str | None = None
    updates: PatientUpdate | None = None


class AssignRequest(BaseModel):
    patient_id: uuid.UUID


class PaymentInitiateRequest(BaseModel):
    patient_id: uuid.UUID


class PaymentOfflineRequest(BaseModel):
    patient_id: uuid.UUID
    receipt_number: str

    @field_validator("receipt_number")
    @classmethod
    def _not_blank(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("receipt_number is required for offline payments")
        return v


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    date_of_birth: date
    gender: Gender
    id_number: str
    blood_group: str | None
    mobile: str
    mobile_verified: bool
    email: str | None
    address: str | None
    emergency_name: str
    emergency_phone: str

    intake_channel: IntakeChannel
    profile_status: ProfileStatus
    admission_type: AdmissionType
    chief_complaint: str

    medico_legal: bool
    fir_number: str | None

    department_id: uuid.UUID | None
    doctor_id: uuid.UUID | None
    ward: str | None

    admitted_at: datetime | None
    consult_fee: float | None

    payment_method: PaymentMethod | None
    payment_status: PaymentStatus
    payment_link: str | None
    payment_link_expires: datetime | None
    receipt_number: str | None
    collected_by: uuid.UUID | None

    discharged_at: datetime | None
    created_at: datetime
    updated_at: datetime


class PatientListOut(BaseModel):
    """Slimmer row shape for GET /api/patients list views."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    full_name: str
    mobile: str
    gender: Gender
    intake_channel: IntakeChannel
    profile_status: ProfileStatus
    admission_type: AdmissionType
    department_id: uuid.UUID | None
    doctor_id: uuid.UUID | None
    payment_status: PaymentStatus
    admitted_at: datetime | None
    discharged_at: datetime | None
    created_at: datetime
