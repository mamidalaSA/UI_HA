import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.pharmacy.models import BillingPaymentStatus, DispenseStatus


class PrescriptionLineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    medicine_name: str
    dosage: str
    route: str
    frequency: str
    start_date: date
    duration_days: int
    with_food: bool
    special_instructions: str | None = None


class QueueItemOut(BaseModel):
    """One pending pharmacy queue row: a PharmacyPrescription joined with its
    patient (for name/admission time) and its prescription's medicine lines."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # PharmacyPrescription.id — the id used by the /dispense endpoint
    prescription_id: uuid.UUID
    patient_id: uuid.UUID
    patient_name: str
    ward: str | None = None
    admitted_at: datetime | None = None
    status: DispenseStatus
    lines: list[PrescriptionLineOut]


class DispenseLineOverride(BaseModel):
    """Optional per-line quantity override for a dispense request."""

    prescription_line_id: uuid.UUID
    quantity: int = Field(gt=0)


class DispenseRequest(BaseModel):
    # ASSUMPTION: spec says "assume quantity=1 unit per line for simplicity, or accept an
    # optional quantity override" — we do the latter. Any PrescriptionLine not named here
    # defaults to a quantity of 1 unit dispensed.
    lines: list[DispenseLineOverride] | None = None

    # Collect payment for this dispense in the same action, at the pharmacy counter.
    # When omitted, the bill is created pending and can be collected later from the
    # Billing/Patients screens.
    receipt_number: str | None = None


class ShortageItem(BaseModel):
    medicine_name: str
    required_quantity: int
    available_quantity: int


class DispenseResponse(BaseModel):
    status: DispenseStatus
    dispensed_lines: int = 0
    total_amount: float = 0
    payment_status: BillingPaymentStatus | None = None
    receipt_number: str | None = None
    shortages: list[ShortageItem] = Field(default_factory=list)


class StockItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    medicine_name: str
    batch_number: str
    expiry_date: date
    quantity: int
    min_threshold: int
    unit_price: float
    is_expired_flagged: bool


class StockItemUpdate(BaseModel):
    """Fields editable when restocking / correcting a stock row. All optional — only
    supplied fields are updated (PATCH semantics)."""

    quantity: int | None = Field(default=None, ge=0)
    min_threshold: int | None = Field(default=None, ge=0)
    unit_price: float | None = Field(default=None, ge=0)
    batch_number: str | None = None
    expiry_date: date | None = None


class ReturnRequest(BaseModel):
    stock_item_id: uuid.UUID
    quantity: int = Field(gt=0)
    kind: Literal["return", "wastage"]
    notes: str | None = None


class DispenseLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    pharmacy_prescription_id: uuid.UUID | None = None
    stock_item_id: uuid.UUID
    quantity: int
    kind: str
    notes: str | None = None
    dispensed_at: datetime


class PatientMedicineHistoryItemOut(BaseModel):
    """One dispensed-medicine line for a patient's pharmacy history."""

    id: uuid.UUID  # billing entry id
    medicine_name: str
    quantity: int | None = None
    amount: float
    payment_status: BillingPaymentStatus
    receipt_number: str | None = None
    dispensed_at: datetime
    paid_at: datetime | None = None


class PendingBillOut(BaseModel):
    """One patient with outstanding (uncollected) pharmacy charges."""

    patient_id: uuid.UUID
    patient_name: str
    pending_amount: float
    pending_entries: int
    last_dispensed_at: datetime


class PatientBillingSummaryOut(BaseModel):
    """One row per patient who has ever had a pharmacy dispense — the lasting
    lookup list, independent of queue/payment status (both stop showing a patient
    once dispensed/collected)."""

    patient_id: uuid.UUID
    patient_name: str
    total_entries: int
    pending_amount: float
    paid_amount: float
    last_dispensed_at: datetime


class CollectBillRequest(BaseModel):
    receipt_number: str = Field(min_length=1)


class CollectBillResponse(BaseModel):
    patient_id: uuid.UUID
    collected_amount: float
    entries_collected: int
    receipt_number: str
