import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.modules.labs.models import TestOrderStatus


class TestQueueOut(BaseModel):
    """One row in the lab work queue — a TestOrder enriched with patient + catalogue names."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    doctor_id: uuid.UUID
    test_type_id: uuid.UUID
    test_name: str
    category: str
    status: TestOrderStatus
    ordered_at: datetime
    notes: str | None = None


class TestOrderOut(BaseModel):
    """Bare TestOrder fields, no joins — used for simple state-transition responses."""

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


class TestHistoryOut(BaseModel):
    """Full TestOrder record for history views, with result_file_url resolved to a presigned URL."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    patient_id: uuid.UUID
    doctor_id: uuid.UUID
    test_type_id: uuid.UUID
    test_name: str
    category: str
    status: TestOrderStatus
    ordered_at: datetime
    result_text: str | None = None
    result_file_url: str | None = None
    completed_at: datetime | None = None
    reviewed_at: datetime | None = None
    notes: str | None = None
