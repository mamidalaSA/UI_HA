import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Time, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPKMixin


class AlertStatus(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    FIRED = "FIRED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    GIVEN = "GIVEN"
    MISSED = "MISSED"
    CANCELLED = "CANCELLED"


class RouteTo(str, enum.Enum):
    nurse = "nurse"
    patient_app = "patient_app"


class Alert(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "alerts"
    __table_args__ = (
        UniqueConstraint(
            "prescription_line_id", "scheduled_date", "slot_time", name="uq_alert_line_date_slot"
        ),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    prescription_line_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prescription_lines.id"), index=True
    )
    scheduled_date: Mapped[date] = mapped_column(Date)
    slot_time: Mapped[time] = mapped_column(Time)
    fire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    expire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[AlertStatus] = mapped_column(
        Enum(AlertStatus, name="alert_status"), default=AlertStatus.SCHEDULED, index=True
    )
    route_to: Mapped[RouteTo] = mapped_column(Enum(RouteTo, name="alert_route_to"))
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
