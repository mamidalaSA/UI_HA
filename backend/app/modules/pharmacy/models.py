import enum
import uuid
from datetime import date, datetime

from sqlalchemy import DECIMAL, Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPKMixin, utcnow


class DispenseStatus(str, enum.Enum):
    pending = "pending"
    out_of_stock = "out_of_stock"
    dispensed = "dispensed"


class PharmacyPrescription(Base, UUIDPKMixin, TimestampMixin):
    """Link between a prescription and its dispensing status in the pharmacy queue."""

    __tablename__ = "pharmacy_prescriptions"

    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("prescriptions.id"), unique=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    status: Mapped[DispenseStatus] = mapped_column(
        Enum(DispenseStatus, name="dispense_status"), default=DispenseStatus.pending, index=True
    )


class StockItem(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "stock_items"

    medicine_name: Mapped[str] = mapped_column(String(120), index=True)
    batch_number: Mapped[str] = mapped_column(String(60))
    expiry_date: Mapped[date] = mapped_column(Date)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    min_threshold: Mapped[int] = mapped_column(Integer, default=10)
    # Not in the spec's field list, but required to auto-create a billing_entries amount
    # on dispense (spec Module 6: "billing entry created" — no price lives anywhere else).
    unit_price: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0)
    is_expired_flagged: Mapped[bool] = mapped_column(Boolean, default=False)


class DispenseLog(Base, UUIDPKMixin):
    __tablename__ = "dispense_log"

    # Nullable: standalone stock returns/wastage (not tied to a dispensed prescription)
    # also log through this table with no pharmacy_prescription_id.
    pharmacy_prescription_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pharmacy_prescriptions.id"), nullable=True
    )
    stock_item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stock_items.id"))
    quantity: Mapped[int] = mapped_column(Integer)
    dispensed_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    dispensed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    kind: Mapped[str] = mapped_column(String(20), default="dispense")  # dispense | return | wastage
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class BillingEntry(Base, UUIDPKMixin):
    __tablename__ = "billing_entries"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    dispense_log_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dispense_log.id"), nullable=True
    )
    description: Mapped[str] = mapped_column(String(255))
    amount: Mapped[float] = mapped_column(DECIMAL(10, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
