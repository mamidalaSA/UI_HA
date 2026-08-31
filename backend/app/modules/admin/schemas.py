import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.roles import Role


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str
    phone: str | None = None
    role: Role

    # doctor-only
    department_id: uuid.UUID | None = None
    specialty: str | None = None

    # head_nurse-only
    ward: str | None = None


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    is_active: bool | None = None
    role: Role | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    role: Role
    is_active: bool
    ward: str | None
    created_at: datetime


# ---------------------------------------------------------------------------
# Doctors (read-only convenience listing — Doctor.id is distinct from User.id
# and the roster editor / doctor management page need it; not in the spec's
# literal endpoint list but required plumbing for "Manage doctor roster").
# ---------------------------------------------------------------------------


class DoctorOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    is_active: bool
    department_id: uuid.UUID
    specialty: str


# ---------------------------------------------------------------------------
# Departments
# ---------------------------------------------------------------------------


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=20)


class DepartmentUpdate(BaseModel):
    name: str | None = None
    code: str | None = None


class DepartmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    code: str
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Department fees
# ---------------------------------------------------------------------------


class DepartmentFeeUpsert(BaseModel):
    consult_fee: float = Field(gt=0)


class DepartmentFeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    department_id: uuid.UUID
    consult_fee: float


# ---------------------------------------------------------------------------
# Specialty mapping
# ---------------------------------------------------------------------------


class SpecialtyMappingCreate(BaseModel):
    keyword: str = Field(min_length=1, max_length=120)
    specialty: str = Field(min_length=1, max_length=120)


class SpecialtyMappingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    keyword: str
    specialty: str


# ---------------------------------------------------------------------------
# Department specialty
# ---------------------------------------------------------------------------


class DepartmentSpecialtyCreate(BaseModel):
    specialty: str = Field(min_length=1, max_length=120)
    department_id: uuid.UUID


class DepartmentSpecialtyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    specialty: str
    department_id: uuid.UUID


# ---------------------------------------------------------------------------
# Doctor roster
# ---------------------------------------------------------------------------


class DoctorRosterUpsert(BaseModel):
    doctor_id: uuid.UUID
    day_of_week: int = Field(ge=0, le=6)
    is_on_duty: bool = True
    max_patients: int = Field(default=20, gt=0)


class DoctorRosterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    doctor_id: uuid.UUID
    day_of_week: int
    is_on_duty: bool
    max_patients: int


# ---------------------------------------------------------------------------
# Test catalogue
# ---------------------------------------------------------------------------


class TestCatalogueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    department_id: uuid.UUID
    category: str = Field(min_length=1, max_length=60)
    tat_min_hours: float = Field(gt=0)
    tat_max_hours: float = Field(gt=0)


class TestCatalogueUpdate(BaseModel):
    name: str | None = None
    department_id: uuid.UUID | None = None
    category: str | None = None
    tat_min_hours: float | None = None
    tat_max_hours: float | None = None


class TestCatalogueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    department_id: uuid.UUID
    category: str
    tat_min_hours: float
    tat_max_hours: float


# ---------------------------------------------------------------------------
# Medicine formulary
# ---------------------------------------------------------------------------


class MedicineFormularyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    default_dosage: str | None = None
    is_approved: bool = True


class MedicineFormularyUpdate(BaseModel):
    name: str | None = None
    default_dosage: str | None = None
    is_approved: bool | None = None


class MedicineFormularyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    default_dosage: str | None
    is_approved: bool


# ---------------------------------------------------------------------------
# Vitals config
# ---------------------------------------------------------------------------


class VitalsConfigUpsert(BaseModel):
    min_value: float
    max_value: float


class VitalsConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vital_name: str
    min_value: float
    max_value: float


# ---------------------------------------------------------------------------
# Alert window config
# ---------------------------------------------------------------------------


class AlertWindowConfigUpsert(BaseModel):
    fire_before_minutes: int = Field(ge=0)
    expire_after_minutes: int = Field(ge=0)


class AlertWindowConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fire_before_minutes: int
    expire_after_minutes: int


# ---------------------------------------------------------------------------
# Audit log
# ---------------------------------------------------------------------------


class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None
    action: str
    entity: str
    entity_id: str | None
    old_value: dict | None
    new_value: dict | None
    created_at: datetime


class AuditLogPage(BaseModel):
    items: list[AuditLogOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------


class DepartmentBreakdownItem(BaseModel):
    department_id: uuid.UUID | None
    department_name: str | None
    count: int


class GenderBreakdownItem(BaseModel):
    gender: str
    count: int


class ReportsSummaryOut(BaseModel):
    total_patients: int
    admitted_patients: int
    discharged_patients: int
    total_doctors: int
    total_nurses: int
    by_department: list[DepartmentBreakdownItem]
    by_gender: list[GenderBreakdownItem]
