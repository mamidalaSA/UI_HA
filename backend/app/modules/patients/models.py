import enum
import uuid
from datetime import date, datetime

from sqlalchemy import DECIMAL, Boolean, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPKMixin


class Gender(str, enum.Enum):
    M = "M"
    F = "F"
    Other = "Other"


class IntakeChannel(str, enum.Enum):
    emergency = "emergency"
    phone = "phone"
    website = "website"


class ProfileStatus(str, enum.Enum):
    draft = "draft"
    pending = "pending"
    active = "active"
    discharged = "discharged"
    expired = "expired"


class AdmissionType(str, enum.Enum):
    inpatient = "inpatient"
    outpatient = "outpatient"
    day_care = "day-care"


class PaymentMethod(str, enum.Enum):
    online = "online"
    offline = "offline"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    link_sent = "link_sent"
    paid = "paid"
    deferred = "deferred"
    waived = "waived"


class Patient(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "patients"

    full_name: Mapped[str] = mapped_column(String(120))
    date_of_birth: Mapped[date] = mapped_column(Date)
    gender: Mapped[Gender] = mapped_column(Enum(Gender, name="patient_gender"))
    id_number: Mapped[str] = mapped_column(String(20))
    blood_group: Mapped[str | None] = mapped_column(String(5), nullable=True)
    mobile: Mapped[str] = mapped_column(String(15), index=True)
    mobile_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email: Mapped[str | None] = mapped_column(String(120), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_name: Mapped[str] = mapped_column(String(120))
    emergency_phone: Mapped[str] = mapped_column(String(15))

    intake_channel: Mapped[IntakeChannel] = mapped_column(Enum(IntakeChannel, name="intake_channel"))
    profile_status: Mapped[ProfileStatus] = mapped_column(
        Enum(ProfileStatus, name="profile_status"), default=ProfileStatus.draft, index=True
    )
    admission_type: Mapped[AdmissionType] = mapped_column(Enum(AdmissionType, name="admission_type"))
    chief_complaint: Mapped[str] = mapped_column(Text)

    medico_legal: Mapped[bool] = mapped_column(Boolean, default=False)
    fir_number: Mapped[str | None] = mapped_column(String(40), nullable=True)

    department_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("departments.id"), nullable=True
    )
    doctor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("doctors.id"), nullable=True
    )
    # Not in the spec's field list, but required for "Nurse sees only patients in their ward"
    # (Module 4) and the Room/Ward field shown on the registration screenshot.
    ward: Mapped[str | None] = mapped_column(String(60), nullable=True)

    admitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consult_fee: Mapped[float | None] = mapped_column(DECIMAL(10, 2), nullable=True)

    payment_method: Mapped[PaymentMethod | None] = mapped_column(
        Enum(PaymentMethod, name="payment_method"), nullable=True
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status"), default=PaymentStatus.pending
    )
    payment_link: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_link_expires: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    receipt_number: Mapped[str | None] = mapped_column(String(40), nullable=True)
    collected_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    discharged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
