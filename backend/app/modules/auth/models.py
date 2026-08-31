import uuid

from sqlalchemy import Boolean, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.roles import Role
from app.db.base import Base
from app.db.mixins import TimestampMixin, UUIDPKMixin


class User(Base, UUIDPKMixin, TimestampMixin):
    """Every login in the system, across all roles.

    - `doctor` role rows are 1:1 with a `doctors.user_id` row (extra profile data lives there).
    - `head_nurse` role rows use `ward` to scope which patients they can see.
    - `patient` role rows link back to `patients.id` via `patient_profile_id`.
    """

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(15), nullable=True)
    role: Mapped[Role] = mapped_column(Enum(Role, name="user_role"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    ward: Mapped[str | None] = mapped_column(String(60), nullable=True)  # head_nurse only
    patient_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id"), nullable=True
    )
