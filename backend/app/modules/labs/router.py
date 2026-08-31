import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import require_role
from app.core.roles import Role
from app.db.session import get_db
from app.modules.auth.models import User
from app.modules.labs import service
from app.modules.labs.schemas import TestHistoryOut, TestOrderOut, TestQueueOut

router = APIRouter(prefix="/api", tags=["lab"])

# GET /api/patients/{id}/tests is a shared reading endpoint across roles — any authenticated
# staff role (i.e. anyone who isn't the patient-app login) may read a patient's test history.
STAFF_ROLES = tuple(r for r in Role if r != Role.patient)


@router.get("/lab/queue", response_model=list[TestQueueOut])
def lab_queue(
    db: Session = Depends(get_db),
    _user: User = Depends(require_role(Role.lab_staff, Role.admin)),
):
    return service.get_queue(db)


@router.patch("/tests/{test_id}/progress", response_model=TestOrderOut)
def mark_in_progress(
    test_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.lab_staff)),
):
    try:
        order = service.start_progress(db, order_id=test_id, user_id=user.id)
    except service.NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except service.LabError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return order


@router.patch("/tests/{test_id}/complete")
async def complete_test(
    test_id: uuid.UUID,
    result_text: str = Form(...),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.lab_staff)),
):
    try:
        order = await service.complete_test(
            db, order_id=test_id, user_id=user.id, result_text=result_text, file=file
        )
    except service.NotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except service.LabError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return {
        "id": order.id,
        "status": order.status,
        "result_text": order.result_text,
        "result_file_url": order.result_file_url,
        "completed_at": order.completed_at,
    }


@router.get("/patients/{patient_id}/tests", response_model=list[TestHistoryOut])
def patient_tests(
    patient_id: uuid.UUID,
    db: Session = Depends(get_db),
    _user: User = Depends(require_role(*STAFF_ROLES)),
):
    return service.get_patient_tests(db, patient_id=patient_id)
