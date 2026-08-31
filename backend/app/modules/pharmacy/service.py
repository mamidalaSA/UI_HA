import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.notify import notify_user, ward_nurses
from app.modules.auth.models import User
from app.modules.doctors.models import Prescription, PrescriptionLine
from app.modules.patients.models import Patient
from app.modules.pharmacy.models import BillingEntry, DispenseLog, DispenseStatus, PharmacyPrescription, StockItem
from app.modules.pharmacy.schemas import (
    DispenseResponse,
    PrescriptionLineOut,
    QueueItemOut,
    ReturnRequest,
    ShortageItem,
    StockItemUpdate,
)


class DispenseError(Exception):
    """Raised when one or more prescription lines cannot be fully matched to stock.
    Per spec: partial dispensing is not allowed — nothing is deducted if any line is short."""

    def __init__(self, shortages: list[ShortageItem]):
        self.shortages = shortages
        super().__init__("Insufficient stock for one or more medicines")


def _json_safe(values: dict) -> dict:
    """record_audit stores old_value/new_value in a JSON column — Decimal and date/datetime
    objects aren't JSON-serializable as-is, so normalize them first."""
    out: dict = {}
    for key, value in values.items():
        if isinstance(value, Decimal):
            out[key] = float(value)
        elif isinstance(value, (date, datetime)):
            out[key] = value.isoformat()
        elif isinstance(value, uuid.UUID):
            out[key] = str(value)
        else:
            out[key] = value
    return out


def get_queue(db: Session) -> list[QueueItemOut]:
    """Pending pharmacy queue, sorted by the patient's admission time ascending (spec:
    'Pharmacist sees queue sorted by admission time'). Patients without an admitted_at
    (not yet admitted) sort last rather than first."""
    rows = db.execute(
        select(PharmacyPrescription, Patient, Prescription)
        .join(Patient, PharmacyPrescription.patient_id == Patient.id)
        .join(Prescription, PharmacyPrescription.prescription_id == Prescription.id)
        .where(PharmacyPrescription.status == DispenseStatus.pending)
        .order_by(Patient.admitted_at.asc().nulls_last())
    ).all()

    items: list[QueueItemOut] = []
    for pharmacy_rx, patient, prescription in rows:
        lines = list(
            db.execute(
                select(PrescriptionLine).where(PrescriptionLine.prescription_id == prescription.id)
            ).scalars()
        )
        items.append(
            QueueItemOut(
                id=pharmacy_rx.id,
                prescription_id=prescription.id,
                patient_id=patient.id,
                patient_name=patient.full_name,
                ward=patient.ward,
                admitted_at=patient.admitted_at,
                status=pharmacy_rx.status,
                lines=[PrescriptionLineOut.model_validate(line) for line in lines],
            )
        )
    return items


def _find_stock_candidates(db: Session, medicine_name: str) -> list[StockItem]:
    """FEFO candidates: case-insensitive name match, quantity > 0, not flagged expired,
    earliest expiry_date first."""
    return list(
        db.execute(
            select(StockItem)
            .where(
                func.lower(StockItem.medicine_name) == medicine_name.strip().lower(),
                StockItem.quantity > 0,
                StockItem.is_expired_flagged.is_(False),
            )
            .order_by(StockItem.expiry_date.asc())
        ).scalars()
    )


def dispense(
    db: Session,
    *,
    rx_id: uuid.UUID,
    caller: User,
    overrides: dict[uuid.UUID, int] | None = None,
) -> DispenseResponse:
    pharmacy_rx = db.get(PharmacyPrescription, rx_id)
    if pharmacy_rx is None:
        raise LookupError("Pharmacy queue entry not found")
    if pharmacy_rx.status == DispenseStatus.dispensed:
        raise ValueError("This prescription has already been dispensed")

    lines = list(
        db.execute(
            select(PrescriptionLine).where(PrescriptionLine.prescription_id == pharmacy_rx.prescription_id)
        ).scalars()
    )
    if not lines:
        raise ValueError("Linked prescription has no medicine lines")

    overrides = overrides or {}

    # Plan the whole dispense before touching any StockItem, so a shortage on line N doesn't
    # leave lines 1..N-1 partially deducted (spec: "do NOT partially dispense").
    plan: list[tuple[PrescriptionLine, StockItem, int]] = []
    shortages: list[ShortageItem] = []
    # Reserve quantity in-memory per stock item across lines within this one dispense call,
    # so two lines needing the same medicine don't both "claim" the same units before commit.
    reserved: dict[uuid.UUID, int] = {}

    for line in lines:
        needed = overrides.get(line.id, 1)
        candidates = _find_stock_candidates(db, line.medicine_name)
        total_available = sum(item.quantity - reserved.get(item.id, 0) for item in candidates)

        remaining = needed
        chosen: list[tuple[StockItem, int]] = []
        for item in candidates:
            free = item.quantity - reserved.get(item.id, 0)
            if free <= 0:
                continue
            take = min(free, remaining)
            chosen.append((item, take))
            reserved[item.id] = reserved.get(item.id, 0) + take
            remaining -= take
            if remaining <= 0:
                break

        if remaining > 0:
            shortages.append(
                ShortageItem(
                    medicine_name=line.medicine_name,
                    required_quantity=needed,
                    available_quantity=max(total_available, 0),
                )
            )
        else:
            for item, take in chosen:
                plan.append((line, item, take))

    if shortages:
        pharmacy_rx.status = DispenseStatus.out_of_stock
        record_audit(
            db,
            user_id=caller.id,
            action="dispense_out_of_stock",
            entity="pharmacy_prescriptions",
            entity_id=pharmacy_rx.id,
            new_value={"shortages": [s.model_dump() for s in shortages]},
        )
        db.commit()
        raise DispenseError(shortages)

    total_amount = 0.0
    dispensed_lines = 0
    for line, item, take in plan:
        item.quantity -= take
        log = DispenseLog(
            pharmacy_prescription_id=pharmacy_rx.id,
            stock_item_id=item.id,
            quantity=take,
            dispensed_by=caller.id,
            kind="dispense",
        )
        db.add(log)
        db.flush()  # populate log.id for the billing entry FK

        amount = float(item.unit_price) * take
        db.add(
            BillingEntry(
                patient_id=pharmacy_rx.patient_id,
                dispense_log_id=log.id,
                description=line.medicine_name,
                amount=amount,
            )
        )
        total_amount += amount
        dispensed_lines += 1

    pharmacy_rx.status = DispenseStatus.dispensed

    record_audit(
        db,
        user_id=caller.id,
        action="dispense",
        entity="pharmacy_prescriptions",
        entity_id=pharmacy_rx.id,
        new_value={"dispensed_lines": dispensed_lines, "total_amount": total_amount},
    )

    # Spec step 5: "... nurse notified". Notify every head_nurse assigned to the patient's ward.
    patient = db.get(Patient, pharmacy_rx.patient_id)
    if patient is not None and patient.ward:
        for nurse in ward_nurses(db, patient.ward):
            notify_user(
                db,
                user_id=nurse.id,
                title="Medication dispensed",
                body=f"Medication dispensed for {patient.full_name} (ward {patient.ward}).",
                data={"patient_id": str(patient.id), "pharmacy_prescription_id": str(pharmacy_rx.id)},
            )

    db.commit()
    return DispenseResponse(status=pharmacy_rx.status, dispensed_lines=dispensed_lines, total_amount=total_amount)


def list_stock(db: Session) -> list[StockItem]:
    return list(db.execute(select(StockItem).order_by(StockItem.medicine_name.asc())).scalars())


def low_stock(db: Session) -> list[StockItem]:
    return list(
        db.execute(
            select(StockItem).where(StockItem.quantity < StockItem.min_threshold).order_by(StockItem.quantity.asc())
        ).scalars()
    )


def update_stock(db: Session, *, item_id: uuid.UUID, payload: StockItemUpdate, caller: User) -> StockItem:
    item = db.get(StockItem, item_id)
    if item is None:
        raise LookupError("Stock item not found")

    old_value = _json_safe(
        {
            "quantity": item.quantity,
            "min_threshold": item.min_threshold,
            "unit_price": item.unit_price,
            "batch_number": item.batch_number,
            "expiry_date": item.expiry_date,
        }
    )

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(item, field, value)

    record_audit(
        db,
        user_id=caller.id,
        action="update",
        entity="stock_items",
        entity_id=item.id,
        old_value=old_value,
        new_value=_json_safe(data),
    )
    db.commit()
    db.refresh(item)
    return item


def create_return(db: Session, *, payload: ReturnRequest, caller: User) -> DispenseLog:
    """Log a stock return or wastage event.

    Interpretation (spec is ambiguous on the exact semantics — documenting the choice made):
    - kind="return": stock physically comes back to the pharmacy (e.g. an unused dispensed
      item), so StockItem.quantity is incremented back up by `quantity`.
    - kind="wastage": covers the common case where stock was already deducted/lost (spoiled,
      dropped, expired before use) — this is purely a log entry and does NOT change
      StockItem.quantity, per the spec note "stock was already deducted or lost, no quantity
      change needed". We do not implement the alternate "pre-dispense wastage" branch (which
      would additionally deduct quantity) because the API contract gives no field to
      distinguish that case from the default one.

    KNOWN LIMITATION: DispenseLog.pharmacy_prescription_id is declared NOT NULL in
    app/modules/pharmacy/models.py (Mapped[uuid.UUID], no nullable=True). The spec for this
    endpoint calls for standalone return/wastage rows with pharmacy_prescription_id = null
    (not tied to any particular dispense). Per the parallel-build rules for this task, models.py
    is a shared file this module must not edit, so that column's nullability could not be
    changed here. This function still sets pharmacy_prescription_id=None for a standalone
    return/wastage entry; against the real Postgres schema as currently defined that INSERT
    will raise a NOT NULL constraint violation until a follow-up migration makes the column
    `nullable=True`. Flagging this rather than silently working around it with a fake FK target.
    """
    item = db.get(StockItem, payload.stock_item_id)
    if item is None:
        raise LookupError("Stock item not found")

    log = DispenseLog(
        pharmacy_prescription_id=None,  # see KNOWN LIMITATION above
        stock_item_id=item.id,
        quantity=payload.quantity,
        dispensed_by=caller.id,
        kind=payload.kind,
        notes=payload.notes,
    )
    db.add(log)

    if payload.kind == "return":
        item.quantity += payload.quantity

    record_audit(
        db,
        user_id=caller.id,
        action=payload.kind,
        entity="dispense_log",
        entity_id=item.id,
        new_value={"stock_item_id": str(item.id), "quantity": payload.quantity, "kind": payload.kind, "notes": payload.notes},
    )
    db.commit()
    db.refresh(log)
    return log
