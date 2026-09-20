import secrets
import uuid
from datetime import timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.db.mixins import utcnow
from app.integrations.sms import get_sms_provider
from app.modules.auth.models import User
from app.modules.auth.otp_models import OtpCode


class AuthError(Exception):
    pass


def login(db: Session, *, email: str, password: str) -> tuple[str, User]:
    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        raise AuthError("Invalid email or password")
    token = create_access_token(subject=user.id, role=user.role.value)
    return token, user


def send_otp(db: Session, *, mobile: str, purpose: str) -> None:
    # Random per-request code by default (readable via the mock provider's admin-gated
    # outbox for testing). settings.otp_static_code overrides this for local convenience
    # only — never set it when the API is reachable outside localhost.
    code = settings.otp_static_code or f"{secrets.randbelow(1_000_000):06d}"
    otp = OtpCode(mobile=mobile, code=code, purpose=purpose, expires_at=utcnow() + timedelta(minutes=10))
    db.add(otp)
    db.commit()
    get_sms_provider().send(to=mobile, message=f"Your HMS verification code is {code}")


def verify_otp(db: Session, *, mobile: str, code: str, purpose: str) -> bool:
    otp = db.execute(
        select(OtpCode)
        .where(OtpCode.mobile == mobile, OtpCode.purpose == purpose, OtpCode.consumed_at.is_(None))
        .order_by(OtpCode.created_at.desc())
    ).scalars().first()
    if otp is None or otp.code != code or otp.expires_at < utcnow():
        return False
    otp.consumed_at = utcnow()
    otp.verified = True
    db.commit()
    return True
