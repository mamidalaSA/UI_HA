from datetime import timedelta

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.notify import notify_user
from app.core.roles import Role
from app.db.mixins import utcnow
from app.db.session import SessionLocal
from app.modules.auth.models import User
from app.modules.patients.models import Patient, ProfileStatus
from app.modules.pharmacy.models import StockItem


@celery_app.task(name="housekeeping.expire_draft_patients")
def expire_draft_patients() -> int:
    """Draft profiles older than draft_expiry_hours (default 48h) auto-expire — spec Module 1."""
    db = SessionLocal()
    try:
        cutoff = utcnow() - timedelta(hours=settings.draft_expiry_hours)
        stale = db.execute(
            select(Patient).where(Patient.profile_status == ProfileStatus.draft, Patient.created_at < cutoff)
        ).scalars().all()
        for patient in stale:
            patient.profile_status = ProfileStatus.expired
        db.commit()
        return len(stale)
    finally:
        db.close()


@celery_app.task(name="housekeeping.flag_expired_stock")
def flag_expired_stock() -> int:
    """Runs at the start of each day — spec Module 6."""
    db = SessionLocal()
    try:
        today = utcnow().date()
        expired = db.execute(
            select(StockItem).where(StockItem.expiry_date < today, StockItem.is_expired_flagged.is_(False))
        ).scalars().all()
        for item in expired:
            item.is_expired_flagged = True
        db.commit()
        return len(expired)
    finally:
        db.close()


@celery_app.task(name="housekeeping.flag_low_stock")
def flag_low_stock() -> int:
    """Runs at the start of each day and pushes a notice to every pharmacist — spec Module 6."""
    db = SessionLocal()
    try:
        low = db.execute(select(StockItem).where(StockItem.quantity < StockItem.min_threshold)).scalars().all()
        if low:
            pharmacists = db.execute(select(User).where(User.role == Role.pharmacist, User.is_active.is_(True))).scalars().all()
            names = ", ".join(item.medicine_name for item in low[:5])
            for pharmacist in pharmacists:
                notify_user(
                    db,
                    user_id=pharmacist.id,
                    title="Low stock alert",
                    body=f"{len(low)} item(s) below threshold: {names}",
                )
        return len(low)
    finally:
        db.close()
