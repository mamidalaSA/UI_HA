import enum
import uuid
from datetime import datetime

from sqlalchemy import DECIMAL, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import UUIDPKMixin, utcnow


class TestOrderStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    reviewed = "reviewed"
    cancelled = "cancelled"


class LabPaymentStatus(str, enum.Enum):
    pending = "pending"
    paid = "paid"
    waived = "waived"


class TestOrder(Base, UUIDPKMixin):
    __tablename__ = "test_orders"

    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id"), index=True)
    doctor_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("doctors.id"))
    test_type_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("test_catalogue.id"))
    status: Mapped[TestOrderStatus] = mapped_column(
        Enum(TestOrderStatus, name="test_order_status"), default=TestOrderStatus.pending, index=True
    )
    ordered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    result_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_file_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Billing: amount is stamped from TestCatalogue.price when the order is created
    # (doctors.service.create_test_order), same pattern as pharmacy's dispense-time
    # BillingEntry.amount snapshot.
    amount: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0)
    payment_status: Mapped[LabPaymentStatus] = mapped_column(
        Enum(LabPaymentStatus, name="lab_payment_status"), default=LabPaymentStatus.pending, index=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    collected_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    receipt_number: Mapped[str | None] = mapped_column(String(60), nullable=True)
