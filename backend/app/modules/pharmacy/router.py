import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.core.roles import Role
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.pharmacy import service
from app.modules.pharmacy.schemas import (
    DispenseLogOut,
    DispenseRequest,
    DispenseResponse,
    QueueItemOut,
    ReturnRequest,
    StockItemOut,
    StockItemUpdate,
)

router = APIRouter(prefix="/api", tags=["pharmacy"])


@router.get("/pharmacy/queue", response_model=list[QueueItemOut])
def get_queue(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role(Role.pharmacist, Role.admin)),
):
    return service.get_queue(db)


@router.patch("/pharmacy/{rx_id}/dispense", response_model=DispenseResponse)
def dispense(
    rx_id: uuid.UUID,
    payload: DispenseRequest = DispenseRequest(),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.pharmacist)),
):
    overrides = {line.prescription_line_id: line.quantity for line in (payload.lines or [])}
    try:
        return service.dispense(db, rx_id=rx_id, caller=user, overrides=overrides)
    except service.DispenseError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "message": "Insufficient stock to dispense this prescription",
                "shortages": [s.model_dump() for s in exc.shortages],
            },
        ) from exc
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


@router.get("/pharmacy/stock", response_model=list[StockItemOut])
def list_stock(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role(Role.pharmacist, Role.admin)),
):
    return service.list_stock(db)


@router.get("/pharmacy/stock/low", response_model=list[StockItemOut])
def low_stock(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role(Role.pharmacist, Role.admin)),
):
    return service.low_stock(db)


@router.patch("/pharmacy/stock/{item_id}", response_model=StockItemOut)
def update_stock(
    item_id: uuid.UUID,
    payload: StockItemUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.pharmacist, Role.admin)),
):
    try:
        return service.update_stock(db, item_id=item_id, payload=payload, caller=user)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc


@router.post("/pharmacy/returns", response_model=DispenseLogOut, status_code=status.HTTP_201_CREATED)
def create_return(
    payload: ReturnRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.pharmacist)),
):
    try:
        return service.create_return(db, payload=payload, caller=user)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
