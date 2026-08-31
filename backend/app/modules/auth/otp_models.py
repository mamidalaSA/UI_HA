from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.mixins import UUIDPKMixin, utcnow


class OtpCode(Base, UUIDPKMixin):
    __tablename__ = "otp_codes"

    mobile: Mapped[str] = mapped_column(String(15), index=True)
    code: Mapped[str] = mapped_column(String(6))
    purpose: Mapped[str] = mapped_column(String(40), default="verify_mobile")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
