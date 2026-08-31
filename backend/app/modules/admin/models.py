import uuid

from datetime import datetime

from sqlalchemy import JSON, DECIMAL, Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPKMixin, utcnow


class Department(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "departments"

    name: Mapped[str] = mapped_column(String(120), unique=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)


class DepartmentFee(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "department_fees"

    department_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id"), unique=True
    )
    consult_fee: Mapped[float] = mapped_column(DECIMAL(10, 2))


class SpecialtyMapping(Base, UUIDPKMixin, TimestampMixin):
    """Keyword -> specialty, matched against a patient's chief_complaint text."""

    __tablename__ = "specialty_mapping"

    keyword: Mapped[str] = mapped_column(String(120), index=True)
    specialty: Mapped[str] = mapped_column(String(120))


class DepartmentSpecialty(Base, UUIDPKMixin, TimestampMixin):
    """Specialty -> department, the second hop of auto-assignment."""

    __tablename__ = "department_specialty"

    specialty: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    department_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"))


class TestCatalogue(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "test_catalogue"

    name: Mapped[str] = mapped_column(String(120))
    department_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("departments.id"))
    category: Mapped[str] = mapped_column(String(60))  # e.g. Pathology, Radiology, Cardiology
    tat_min_hours: Mapped[float] = mapped_column(DECIMAL(5, 2))
    tat_max_hours: Mapped[float] = mapped_column(DECIMAL(5, 2))


class MedicineFormulary(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "medicine_formulary"

    name: Mapped[str] = mapped_column(String(120), unique=True)
    default_dosage: Mapped[str | None] = mapped_column(String(40), nullable=True)
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True)


class VitalsConfig(Base, UUIDPKMixin, TimestampMixin):
    """Normal ranges per vital, configurable by Admin instead of hardcoded."""

    __tablename__ = "vitals_config"

    vital_name: Mapped[str] = mapped_column(String(60), unique=True)
    min_value: Mapped[float] = mapped_column(DECIMAL(6, 1))
    max_value: Mapped[float] = mapped_column(DECIMAL(6, 1))


class AlertWindowConfig(Base, UUIDPKMixin, TimestampMixin):
    """How many minutes before/after a dose slot the alert fires / expires."""

    __tablename__ = "alert_window_config"

    fire_before_minutes: Mapped[int] = mapped_column(Integer, default=15)
    expire_after_minutes: Mapped[int] = mapped_column(Integer, default=30)


class AuditLog(Base, UUIDPKMixin):
    __tablename__ = "audit_log"

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(60))  # create | update | delete | custom verb
    entity: Mapped[str] = mapped_column(String(60))  # table/entity name
    entity_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    old_value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_value: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
