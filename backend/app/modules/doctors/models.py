import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPKMixin, utcnow


class Doctor(Base, UUIDPKMixin, TimestampMixin):
    """Extra profile data for a User with role=doctor."""

    __tablename__ = "doctors"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    department_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"))
    specialty: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class DoctorRoster(Base, UUIDPKMixin, TimestampMixin):
    """Recurring weekly duty roster used by auto-assignment to find who's on duty today."""

    __tablename__ = "doctor_roster"
    __table_args__ = (UniqueConstraint("doctor_id", "day_of_week", name="uq_doctor_roster_doctor_day"),)

    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"))
    day_of_week: Mapped[int] = mapped_column(Integer)  # 0=Monday .. 6=Sunday
    is_on_duty: Mapped[bool] = mapped_column(Boolean, default=True)
    max_patients: Mapped[int] = mapped_column(Integer, default=20)


class ExaminationNote(Base, UUIDPKMixin):
    """Doctor's examination notes. Discharge and transfer both require >=1 of these to exist."""

    __tablename__ = "examination_notes"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"))
    note_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Prescription(Base, UUIDPKMixin):
    __tablename__ = "prescriptions"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"))
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Route(str, enum.Enum):
    oral = "oral"
    IV = "IV"
    IM = "IM"
    topical = "topical"
    inhalation = "inhalation"


class Frequency(str, enum.Enum):
    once_daily = "once_daily"
    twice_daily = "twice_daily"
    thrice_daily = "thrice_daily"
    every_6h = "every_6h"
    every_8h = "every_8h"
    as_needed = "as_needed"


# Frequency -> list of daily dose times, per spec Module 3.
FREQUENCY_SLOTS: dict[Frequency, list[str]] = {
    Frequency.once_daily: ["08:00"],
    Frequency.twice_daily: ["08:00", "20:00"],
    Frequency.thrice_daily: ["08:00", "14:00", "20:00"],
    Frequency.every_6h: ["06:00", "12:00", "18:00", "00:00"],
    Frequency.every_8h: ["06:00", "14:00", "22:00"],
    Frequency.as_needed: [],
}


class PrescriptionLine(Base, UUIDPKMixin):
    __tablename__ = "prescription_lines"

    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prescriptions.id"), index=True
    )
    medicine_name: Mapped[str] = mapped_column(String(120))
    dosage: Mapped[str] = mapped_column(String(40))
    route: Mapped[Route] = mapped_column(Enum(Route, name="prescription_route"))
    frequency: Mapped[Frequency] = mapped_column(Enum(Frequency, name="prescription_frequency"))
    start_date: Mapped[date] = mapped_column(Date)
    duration_days: Mapped[int] = mapped_column(Integer)
    with_food: Mapped[bool] = mapped_column(Boolean, default=False)
    special_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
