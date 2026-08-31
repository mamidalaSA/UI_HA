import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.roles import Role
from app.integrations.push import get_push_provider
from app.integrations.sms import get_sms_provider
from app.modules.auth.models import User


def notify_user(db: Session, *, user_id: uuid.UUID, title: str, body: str, sms_to: str | None = None, data: dict | None = None) -> None:
    get_push_provider().send(user_id=user_id, title=title, body=body, data=data)
    if sms_to:
        get_sms_provider().send(to=sms_to, message=f"{title}: {body}")


def ward_nurses(db: Session, ward: str) -> list[User]:
    return list(
        db.execute(select(User).where(User.role == Role.head_nurse, User.ward == ward, User.is_active.is_(True))).scalars()
    )


def doctor_user(db: Session, doctor_id: uuid.UUID):
    from app.modules.doctors.models import Doctor  # local import avoids a module-load cycle

    doctor = db.get(Doctor, doctor_id)
    if doctor is None:
        return None
    return db.get(User, doctor.user_id)
