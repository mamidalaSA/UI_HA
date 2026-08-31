import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.transfers.models import TransferStatus, TransferType, Urgency


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------


class TransferInitiate(BaseModel):
    transfer_type: TransferType
    # Server-side min-length check happens in service.initiate_transfer so a
    # too-short reason returns a precise 400 rather than pydantic's default 422.
    reason: str = Field(min_length=1, description="Clinical reason for transfer; must be >= 20 characters.")
    handover_notes: str | None = None

    # Internal transfers only.
    to_dept_id: uuid.UUID | None = None

    # External transfers only.
    to_hospital_name: str | None = None
    to_hospital_contact: str | None = None
    urgency: Urgency = Urgency.routine


class TransferDeclineRequest(BaseModel):
    reason: str = Field(min_length=1)


class TransferCancelRequest(BaseModel):
    reason: str = Field(min_length=1)


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


class TransferOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    from_doctor_id: uuid.UUID
    from_dept_id: uuid.UUID
    transfer_type: TransferType

    to_dept_id: uuid.UUID | None = None
    to_doctor_id: uuid.UUID | None = None
    to_hospital_name: str | None = None
    to_hospital_contact: str | None = None

    urgency: Urgency
    transfer_reason: str
    handover_notes: str | None = None
    status: TransferStatus
    decline_count: int
    decline_reason: str | None = None
    admin_approved_by: uuid.UUID | None = None
    discharge_summary_url: str | None = None

    initiated_at: datetime
    accepted_at: datetime | None = None
    completed_at: datetime | None = None


class TransferListOut(BaseModel):
    transfers: list[TransferOut]


class TransferSummaryOut(BaseModel):
    id: uuid.UUID
    discharge_summary_url: str
