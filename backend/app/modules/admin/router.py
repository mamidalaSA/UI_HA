import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_role
from app.core.roles import Role
from app.db.session import get_db
from app.integrations.push import MockPushProvider
from app.integrations.sms import MockSmsProvider
from app.modules.admin import service
from app.modules.admin.schemas import (
    AlertWindowConfigOut,
    AlertWindowConfigUpsert,
    AuditLogPage,
    DepartmentCreate,
    DepartmentFeeOut,
    DepartmentFeeUpsert,
    DepartmentOut,
    DepartmentSpecialtyCreate,
    DepartmentSpecialtyOut,
    DepartmentUpdate,
    DoctorOut,
    DoctorRosterOut,
    DoctorRosterUpsert,
    MedicineFormularyCreate,
    MedicineFormularyOut,
    MedicineFormularyUpdate,
    ReportsSummaryOut,
    SpecialtyMappingCreate,
    SpecialtyMappingOut,
    TestCatalogueCreate,
    TestCatalogueOut,
    TestCatalogueUpdate,
    UserCreate,
    UserOut,
    UserUpdate,
    VitalsConfigOut,
    VitalsConfigUpsert,
)
from app.modules.auth.models import User

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(get_current_user)])


def _raise_service_error(exc: service.AdminServiceError) -> None:
    raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db), actor: User = Depends(require_role(Role.admin))):
    try:
        return service.create_user(db, payload=payload, actor=actor)
    except service.AdminServiceError as exc:
        _raise_service_error(exc)


@router.get("/users", response_model=list[UserOut])
def list_users(
    role: Role | None = Query(default=None),
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(Role.admin)),
):
    return service.list_users(db, role=role)


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(Role.admin)),
):
    try:
        return service.update_user(db, user_id=user_id, payload=payload, actor=actor)
    except service.AdminServiceError as exc:
        _raise_service_error(exc)


# ---------------------------------------------------------------------------
# Doctors (read-only convenience listing, see schemas.DoctorOut)
# ---------------------------------------------------------------------------


@router.get("/doctors", response_model=list[DoctorOut])
def list_doctors(db: Session = Depends(get_db)):
    return service.list_doctors(db)


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------


@router.get("/departments", response_model=list[DepartmentOut])
def list_departments(db: Session = Depends(get_db)):
    return service.list_departments(db)


@router.post("/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
def create_department(
    payload: DepartmentCreate, db: Session = Depends(get_db), actor: User = Depends(require_role(Role.admin))
):
    return service.create_department(db, payload=payload, actor=actor)


@router.patch("/departments/{department_id}", response_model=DepartmentOut)
def update_department(
    department_id: uuid.UUID,
    payload: DepartmentUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(Role.admin)),
):
    try:
        return service.update_department(db, department_id=department_id, payload=payload, actor=actor)
    except service.AdminServiceError as exc:
        _raise_service_error(exc)


# ---------------------------------------------------------------------------
# Department fees
# ---------------------------------------------------------------------------


@router.get("/department-fees", response_model=list[DepartmentFeeOut])
def list_department_fees(db: Session = Depends(get_db)):
    return service.list_department_fees(db)


@router.put("/department-fees/{department_id}", response_model=DepartmentFeeOut)
def upsert_department_fee(
    department_id: uuid.UUID,
    payload: DepartmentFeeUpsert,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(Role.admin)),
):
    try:
        return service.upsert_department_fee(db, department_id=department_id, payload=payload, actor=actor)
    except service.AdminServiceError as exc:
        _raise_service_error(exc)


# ---------------------------------------------------------------------------
# Specialty mapping
# ---------------------------------------------------------------------------


@router.get("/specialty-mapping", response_model=list[SpecialtyMappingOut])
def list_specialty_mapping(db: Session = Depends(get_db)):
    return service.list_specialty_mapping(db)


@router.post("/specialty-mapping", response_model=SpecialtyMappingOut, status_code=status.HTTP_201_CREATED)
def create_specialty_mapping(
    payload: SpecialtyMappingCreate, db: Session = Depends(get_db), actor: User = Depends(require_role(Role.admin))
):
    return service.create_specialty_mapping(db, payload=payload, actor=actor)


@router.delete("/specialty-mapping/{mapping_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_specialty_mapping(
    mapping_id: uuid.UUID, db: Session = Depends(get_db), actor: User = Depends(require_role(Role.admin))
):
    try:
        service.delete_specialty_mapping(db, mapping_id=mapping_id, actor=actor)
    except service.AdminServiceError as exc:
        _raise_service_error(exc)


# ---------------------------------------------------------------------------
# Department specialty
# ---------------------------------------------------------------------------


@router.get("/department-specialty", response_model=list[DepartmentSpecialtyOut])
def list_department_specialty(db: Session = Depends(get_db)):
    return service.list_department_specialty(db)


@router.post("/department-specialty", response_model=DepartmentSpecialtyOut, status_code=status.HTTP_201_CREATED)
def create_department_specialty(
    payload: DepartmentSpecialtyCreate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(Role.admin)),
):
    try:
        return service.create_department_specialty(db, payload=payload, actor=actor)
    except service.AdminServiceError as exc:
        _raise_service_error(exc)


# ---------------------------------------------------------------------------
# Doctor roster
# ---------------------------------------------------------------------------


@router.get("/doctor-roster", response_model=list[DoctorRosterOut])
def list_doctor_roster(doctor_id: uuid.UUID | None = Query(default=None), db: Session = Depends(get_db)):
    return service.list_doctor_roster(db, doctor_id=doctor_id)


@router.post("/doctor-roster", response_model=DoctorRosterOut, status_code=status.HTTP_201_CREATED)
def upsert_doctor_roster(
    payload: DoctorRosterUpsert, db: Session = Depends(get_db), actor: User = Depends(require_role(Role.admin))
):
    try:
        return service.upsert_doctor_roster(db, payload=payload, actor=actor)
    except service.AdminServiceError as exc:
        _raise_service_error(exc)


# ---------------------------------------------------------------------------
# Test catalogue
# ---------------------------------------------------------------------------


@router.get("/test-catalogue", response_model=list[TestCatalogueOut])
def list_test_catalogue(db: Session = Depends(get_db)):
    return service.list_test_catalogue(db)


@router.post("/test-catalogue", response_model=TestCatalogueOut, status_code=status.HTTP_201_CREATED)
def create_test_catalogue(
    payload: TestCatalogueCreate, db: Session = Depends(get_db), actor: User = Depends(require_role(Role.admin))
):
    try:
        return service.create_test_catalogue(db, payload=payload, actor=actor)
    except service.AdminServiceError as exc:
        _raise_service_error(exc)


@router.patch("/test-catalogue/{entry_id}", response_model=TestCatalogueOut)
def update_test_catalogue(
    entry_id: uuid.UUID,
    payload: TestCatalogueUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(Role.admin)),
):
    try:
        return service.update_test_catalogue(db, entry_id=entry_id, payload=payload, actor=actor)
    except service.AdminServiceError as exc:
        _raise_service_error(exc)


# ---------------------------------------------------------------------------
# Medicine formulary
# ---------------------------------------------------------------------------


@router.get("/medicine-formulary", response_model=list[MedicineFormularyOut])
def list_medicine_formulary(db: Session = Depends(get_db)):
    return service.list_medicine_formulary(db)


@router.post("/medicine-formulary", response_model=MedicineFormularyOut, status_code=status.HTTP_201_CREATED)
def create_medicine_formulary(
    payload: MedicineFormularyCreate, db: Session = Depends(get_db), actor: User = Depends(require_role(Role.admin))
):
    try:
        return service.create_medicine_formulary(db, payload=payload, actor=actor)
    except service.AdminServiceError as exc:
        _raise_service_error(exc)


@router.patch("/medicine-formulary/{entry_id}", response_model=MedicineFormularyOut)
def update_medicine_formulary(
    entry_id: uuid.UUID,
    payload: MedicineFormularyUpdate,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(Role.admin)),
):
    try:
        return service.update_medicine_formulary(db, entry_id=entry_id, payload=payload, actor=actor)
    except service.AdminServiceError as exc:
        _raise_service_error(exc)


# ---------------------------------------------------------------------------
# Vitals config
# ---------------------------------------------------------------------------


@router.get("/vitals-config", response_model=list[VitalsConfigOut])
def list_vitals_config(db: Session = Depends(get_db)):
    return service.list_vitals_config(db)


@router.put("/vitals-config/{vital_name}", response_model=VitalsConfigOut)
def upsert_vitals_config(
    vital_name: str,
    payload: VitalsConfigUpsert,
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(Role.admin)),
):
    return service.upsert_vitals_config(db, vital_name=vital_name, payload=payload, actor=actor)


# ---------------------------------------------------------------------------
# Alert window config
# ---------------------------------------------------------------------------


@router.get("/alert-window-config", response_model=AlertWindowConfigOut | None)
def get_alert_window_config(db: Session = Depends(get_db)):
    return service.get_alert_window_config(db)


@router.put("/alert-window-config", response_model=AlertWindowConfigOut)
def upsert_alert_window_config(
    payload: AlertWindowConfigUpsert, db: Session = Depends(get_db), actor: User = Depends(require_role(Role.admin))
):
    return service.upsert_alert_window_config(db, payload=payload, actor=actor)


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


@router.get("/audit-log", response_model=AuditLogPage)
def list_audit_log(
    entity: str | None = Query(default=None),
    user_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    actor: User = Depends(require_role(Role.admin)),
):
    items, total = service.list_audit_log(db, entity=entity, user_id=user_id, page=page, page_size=page_size)
    return AuditLogPage(items=items, total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# Dev debug — mock provider outboxes (no real SMS/push account exists in this build)
# ---------------------------------------------------------------------------


@router.get("/dev/sms-outbox")
def get_sms_outbox(actor: User = Depends(require_role(Role.admin))):
    return MockSmsProvider.outbox


@router.get("/dev/push-outbox")
def get_push_outbox(actor: User = Depends(require_role(Role.admin))):
    return MockPushProvider.outbox


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


@router.get("/reports/summary", response_model=ReportsSummaryOut)
def reports_summary(db: Session = Depends(get_db), actor: User = Depends(require_role(Role.admin))):
    return service.reports_summary(db)
