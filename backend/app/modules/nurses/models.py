import uuid
from datetime import datetime

from sqlalchemy import DECIMAL, Boolean, DateTime, Enum, ForeignKey, SmallInteger, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import UUIDPKMixin, utcnow
from app.modules.doctors.models import Route


class MedicationLog(Base, UUIDPKMixin):
    __tablename__ = "medication_log"

    alert_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("alerts.id"))
    prescription_line_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prescription_lines.id")
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    administered_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    administered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    dose_given: Mapped[str | None] = mapped_column(String(40), nullable=True)
    route_used: Mapped[Route | None] = mapped_column(Enum(Route, name="prescription_route"), nullable=True)
    skipped: Mapped[bool] = mapped_column(Boolean, default=False)
    skip_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class Vitals(Base, UUIDPKMixin):
    __tablename__ = "vitals"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    recorded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    temperature_c: Mapped[float | None] = mapped_column(DECIMAL(4, 1), nullable=True)
    bp_systolic: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    bp_diastolic: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    pulse_bpm: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    spo2_pct: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    resp_rate: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    blood_glucose: Mapped[float | None] = mapped_column(DECIMAL(5, 1), nullable=True)
    gcs_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    flag_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
