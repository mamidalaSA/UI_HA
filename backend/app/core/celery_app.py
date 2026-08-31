from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "hms",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.alert_tasks", "app.workers.housekeeping_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,  # survive worker restarts — a task that dies mid-run is redelivered
    task_reject_on_worker_lost=True,
    task_default_retry_delay=30,
)

celery_app.conf.beat_schedule = {
    "sweep-dose-alerts-every-minute": {
        "task": "alerts.sweep_dose_alerts",
        "schedule": 60.0,
    },
    "expire-draft-patients-hourly": {
        "task": "housekeeping.expire_draft_patients",
        "schedule": crontab(minute=0),
    },
    "flag-expired-stock-daily": {
        "task": "housekeeping.flag_expired_stock",
        "schedule": crontab(hour=0, minute=5),
    },
    "flag-low-stock-daily": {
        "task": "housekeeping.flag_low_stock",
        "schedule": crontab(hour=0, minute=10),
    },
}
