import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.modules.admin.models import AuditLog


def record_audit(
    db: Session,
    *,
    user_id: uuid.UUID | None,
    action: str,
    entity: str,
    entity_id: Any = None,
    old_value: dict | None = None,
    new_value: dict | None = None,
) -> None:
    """Append-only write-action record. Call from service functions right before commit
    so the audit row lands in the same transaction as the change it describes."""
    db.add(
        AuditLog(
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=str(entity_id) if entity_id is not None else None,
            old_value=old_value,
            new_value=new_value,
        )
    )
