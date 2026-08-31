import uuid

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.notify import doctor_user, notify_user
from app.db.mixins import utcnow
from app.integrations.storage import presigned_url, upload_file
from app.modules.admin.models import TestCatalogue
from app.modules.labs.models import TestOrder, TestOrderStatus
from app.modules.labs.schemas import TestHistoryOut, TestQueueOut
from app.modules.patients.models import Patient


class LabError(Exception):
    """Raised for a 400 — invalid state transition."""


class NotFoundError(Exception):
    """Raised for a 404 — no such test order."""


def get_queue(db: Session) -> list[TestQueueOut]:
    stmt = (
        select(TestOrder, Patient.full_name, TestCatalogue.name, TestCatalogue.category)
        .join(Patient, TestOrder.patient_id == Patient.id)
        .join(TestCatalogue, TestOrder.test_type_id == TestCatalogue.id)
        .where(TestOrder.status.in_([TestOrderStatus.pending, TestOrderStatus.in_progress]))
        .order_by(TestOrder.ordered_at)
    )
    rows = db.execute(stmt).all()
    return [
        TestQueueOut(
            id=order.id,
            patient_id=order.patient_id,
            patient_name=patient_name,
            doctor_id=order.doctor_id,
            test_type_id=order.test_type_id,
            test_name=test_name,
            category=category,
            status=order.status,
            ordered_at=order.ordered_at,
            notes=order.notes,
        )
        for order, patient_name, test_name, category in rows
    ]


def _get_order_or_404(db: Session, order_id: uuid.UUID) -> TestOrder:
    order = db.get(TestOrder, order_id)
    if order is None:
        raise NotFoundError("Test order not found")
    return order


def start_progress(db: Session, *, order_id: uuid.UUID, user_id: uuid.UUID) -> TestOrder:
    order = _get_order_or_404(db, order_id)
    if order.status != TestOrderStatus.pending:
        raise LabError(f"Cannot start progress from status '{order.status.value}' — must be 'pending'")

    old_status = order.status.value
    order.status = TestOrderStatus.in_progress

    record_audit(
        db,
        user_id=user_id,
        action="update",
        entity="test_order",
        entity_id=order.id,
        old_value={"status": old_status},
        new_value={"status": order.status.value},
    )
    db.commit()
    db.refresh(order)
    return order


async def complete_test(
    db: Session,
    *,
    order_id: uuid.UUID,
    user_id: uuid.UUID,
    result_text: str,
    file: UploadFile | None,
) -> TestOrder:
    order = _get_order_or_404(db, order_id)
    if order.status in (TestOrderStatus.completed, TestOrderStatus.reviewed):
        raise LabError("Lab cannot modify a result after it has been uploaded (Admin only)")

    old_value = {"status": order.status.value, "result_text": order.result_text}

    order.result_text = result_text
    if file is not None:
        content = await file.read()
        key = upload_file(
            key_prefix=f"test-results/{order.patient_id}",
            filename=file.filename or "result",
            content=content,
            content_type=file.content_type or "application/octet-stream",
        )
        order.result_file_url = key
    order.status = TestOrderStatus.completed
    order.completed_at = utcnow()

    record_audit(
        db,
        user_id=user_id,
        action="update",
        entity="test_order",
        entity_id=order.id,
        old_value=old_value,
        new_value={"status": order.status.value, "result_text": order.result_text},
    )
    db.commit()
    db.refresh(order)

    doctor = doctor_user(db, order.doctor_id)
    if doctor is not None:
        patient = db.get(Patient, order.patient_id)
        patient_name = patient.full_name if patient is not None else "a patient"
        notify_user(
            db,
            user_id=doctor.id,
            title="Test result ready",
            body=f"Result for {patient_name}'s test is ready for review.",
        )

    return order


def get_patient_tests(db: Session, *, patient_id: uuid.UUID) -> list[TestHistoryOut]:
    stmt = (
        select(TestOrder, TestCatalogue.name, TestCatalogue.category)
        .join(TestCatalogue, TestOrder.test_type_id == TestCatalogue.id)
        .where(TestOrder.patient_id == patient_id)
        .order_by(TestOrder.ordered_at.desc())
    )
    rows = db.execute(stmt).all()
    out: list[TestHistoryOut] = []
    for order, test_name, category in rows:
        resolved_url = presigned_url(order.result_file_url) if order.result_file_url else None
        out.append(
            TestHistoryOut(
                id=order.id,
                patient_id=order.patient_id,
                doctor_id=order.doctor_id,
                test_type_id=order.test_type_id,
                test_name=test_name,
                category=category,
                status=order.status,
                ordered_at=order.ordered_at,
                result_text=order.result_text,
                result_file_url=resolved_url,
                completed_at=order.completed_at,
                reviewed_at=order.reviewed_at,
                notes=order.notes,
            )
        )
    return out
