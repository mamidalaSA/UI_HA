import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import UUIDPKMixin, utcnow


class TransferType(str, enum.Enum):
    internal = "internal"
    external = "external"


class Urgency(str, enum.Enum):
    routine = "routine"
    urgent = "urgent"
    emergency = "emergency"


class TransferStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    completed = "completed"
    cancelled = "cancelled"


class PatientTransfer(Base, UUIDPKMixin):
    __tablename__ = "patient_transfers"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    from_doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"))
    from_dept_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"))
    transfer_type: Mapped[TransferType] = mapped_column(Enum(TransferType, name="transfer_type"))

    to_dept_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True
    )
    to_doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True
    )
    to_hospital_name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    to_hospital_contact: Mapped[str | None] = mapped_column(String(120), nullable=True)

    urgency: Mapped[Urgency] = mapped_column(Enum(Urgency, name="transfer_urgency"), default=Urgency.routine)
    transfer_reason: Mapped[str] = mapped_column(Text)
    handover_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[TransferStatus] = mapped_column(
        Enum(TransferStatus, name="transfer_status"), default=TransferStatus.pending, index=True
    )
    decline_count: Mapped[int] = mapped_column(default=0)
    decline_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    admin_approved_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    discharge_summary_url: Mapped[str | None] = mapped_column(String(255), nullable=True)

    initiated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
