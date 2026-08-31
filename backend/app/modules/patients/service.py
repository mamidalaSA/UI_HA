import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.config import settings
from app.core.notify import doctor_user, notify_user
from app.integrations.payments import get_payment_provider
from app.integrations.sms import get_sms_provider
from app.modules.admin.models import DepartmentFee, DepartmentSpecialty, SpecialtyMapping
from app.modules.auth.models import User
from app.modules.auth.otp_models import OtpCode
from app.modules.doctors.models import Doctor, DoctorRoster
from app.modules.patients.models import IntakeChannel, PaymentMethod, PaymentStatus, Patient, ProfileStatus
from app.modules.patients.schemas import PatientCreate, PatientUpdate


class PatientError(Exception):
    """Raised for business-rule violations. The router maps this to an HTTPException
    using `status_code`."""

    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Auto-assignment (spec Module 1: "Auto-assignment")
# ---------------------------------------------------------------------------


def _match_specialty(db: Session, chief_complaint: str) -> str | None:
    """Case-insensitive substring match of chief_complaint against SpecialtyMapping
    keywords. If multiple keywords match, the longest keyword wins."""
    complaint = (chief_complaint or "").lower()
    if not complaint:
        return None
    mappings = db.execute(select(SpecialtyMapping)).scalars().all()
    matches = [m for m in mappings if m.keyword and m.keyword.lower() in complaint]
    if not matches:
        return None
    best = max(matches, key=lambda m: len(m.keyword))
    return best.specialty


def run_auto_assignment(db: Session, patient: Patient) -> Patient:
    """Match chief_complaint -> specialty -> department -> doctor on duty today with
    the fewest active patients. Writes doctor_id/department_id/consult_fee onto the
    patient and push-notifies the assigned doctor. Never raises — if no specialty/
    department/doctor can be resolved, the relevant fields are simply left as-is
    (except doctor_id, which is explicitly nulled when a department was found but no
    doctor is on duty, per spec step 4)."""
    specialty = _match_specialty(db, patient.chief_complaint)
    if specialty is None:
        return patient

    dept_specialty = db.execute(
        select(DepartmentSpecialty).where(DepartmentSpecialty.specialty == specialty)
    ).scalar_one_or_none()
    if dept_specialty is None:
        return patient

    department_id = dept_specialty.department_id
    patient.department_id = department_id

    fee_row = db.execute(
        select(DepartmentFee).where(DepartmentFee.department_id == department_id)
    ).scalar_one_or_none()
    if fee_row is not None:
        patient.consult_fee = fee_row.consult_fee

    today_dow = _utcnow().weekday()  # Monday=0 .. Sunday=6
    on_duty_doctors = db.execute(
        select(Doctor)
        .join(DoctorRoster, DoctorRoster.doctor_id == Doctor.id)
        .where(
            Doctor.department_id == department_id,
            Doctor.is_active.is_(True),
            DoctorRoster.day_of_week == today_dow,
            DoctorRoster.is_on_duty.is_(True),
        )
    ).scalars().all()

    if not on_duty_doctors:
        patient.doctor_id = None
        return patient

    def _active_load(doctor_id: uuid.UUID) -> int:
        return db.execute(
            select(func.count())
            .select_from(Patient)
            .where(Patient.doctor_id == doctor_id, Patient.profile_status == ProfileStatus.active)
        ).scalar_one()

    best_doctor = min(on_duty_doctors, key=lambda d: _active_load(d.id))
    patient.doctor_id = best_doctor.id

    assigned_user = doctor_user(db, best_doctor.id)
    if assigned_user is not None:
        notify_user(
            db,
            user_id=assigned_user.id,
            title="New patient assigned",
            body=f"{patient.full_name} — {patient.chief_complaint}",
        )

    return patient


# ---------------------------------------------------------------------------
# Payments
# ---------------------------------------------------------------------------


def initiate_payment(db: Session, patient: Patient, *, current_user: User) -> Patient:
    """Create a payment order for the patient's consult_fee, set payment_link /
    payment_link_expires / payment_status=link_sent, and SMS the link. Used by
    POST /api/payments/initiate (including the "Resend link" button) and internally
    on activation."""
    if patient.consult_fee is None:
        raise PatientError("Patient has no consult_fee set yet — run auto-assignment first", 400)

    order = get_payment_provider().create_order(
        amount=float(patient.consult_fee),
        patient_id=patient.id,
        receipt=f"patient-{patient.id}",
    )
    patient.payment_link = order.payment_link
    base_time = patient.admitted_at or _utcnow()
    patient.payment_link_expires = base_time + timedelta(hours=settings.payment_link_expiry_hours)
    patient.payment_status = PaymentStatus.link_sent
    patient.payment_method = PaymentMethod.online

    get_sms_provider().send(
        to=patient.mobile,
        message=f"Complete your payment of Rs.{patient.consult_fee} at {order.payment_link} (link valid {settings.payment_link_expiry_hours}h).",
    )

    record_audit(
        db,
        user_id=current_user.id if current_user else None,
        action="payment_initiate",
        entity="patients",
        entity_id=patient.id,
        new_value={"payment_status": patient.payment_status.value, "payment_link": patient.payment_link},
    )
    return patient


def record_offline_payment(db: Session, patient: Patient, *, receipt_number: str, current_user: User) -> Patient:
    old_status = patient.payment_status.value
    patient.receipt_number = receipt_number
    patient.payment_status = PaymentStatus.paid
    patient.payment_method = PaymentMethod.offline
    patient.collected_by = current_user.id

    record_audit(
        db,
        user_id=current_user.id,
        action="payment_offline",
        entity="patients",
        entity_id=patient.id,
        old_value={"payment_status": old_status},
        new_value={"payment_status": patient.payment_status.value, "receipt_number": receipt_number},
    )
    return patient


def mark_payment_paid_from_webhook(db: Session, patient: Patient) -> Patient:
    """Idempotent: only flips + audits if not already paid."""
    if patient.payment_status != PaymentStatus.paid:
        old_status = patient.payment_status.value
        patient.payment_status = PaymentStatus.paid
        record_audit(
            db,
            user_id=None,
            action="payment_webhook",
            entity="patients",
            entity_id=patient.id,
            old_value={"payment_status": old_status},
            new_value={"payment_status": patient.payment_status.value},
        )
    return patient


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------


def create_patient(db: Session, payload: PatientCreate, *, current_user: User) -> Patient:
    patient = Patient(
        full_name=payload.full_name,
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
        id_number=payload.id_number,
        blood_group=payload.blood_group,
        mobile=payload.mobile,
        email=payload.email,
        address=payload.address,
        emergency_name=payload.emergency_name,
        emergency_phone=payload.emergency_phone,
        intake_channel=payload.intake_channel,
        admission_type=payload.admission_type,
        chief_complaint=payload.chief_complaint,
        medico_legal=payload.medico_legal,
        fir_number=payload.fir_number if payload.medico_legal else None,
    )

    if payload.intake_channel == IntakeChannel.emergency:
        patient.profile_status = ProfileStatus.active
        patient.admitted_at = _utcnow()
    elif payload.intake_channel == IntakeChannel.phone:
        patient.profile_status = ProfileStatus.draft
    else:  # website
        patient.profile_status = ProfileStatus.pending

    db.add(patient)
    db.flush()  # assign patient.id for downstream calls without committing yet

    if payload.intake_channel == IntakeChannel.phone:
        # Spec: "System sends appointment confirmation SMS when draft is saved."
        get_sms_provider().send(
            to=patient.mobile,
            message=f"Hi {patient.full_name}, your appointment at City Hospital has been booked. We'll see you soon.",
        )
    elif payload.intake_channel == IntakeChannel.website:
        # Spec: "Patient receives OTP to verify mobile number."
        from app.modules.auth.service import send_otp

        send_otp(db, mobile=patient.mobile, purpose="verify_mobile")

    if payload.intake_channel == IntakeChannel.emergency:
        run_auto_assignment(db, patient)
        if payload.defer_payment:
            patient.payment_status = PaymentStatus.deferred
        elif patient.consult_fee is not None:
            initiate_payment(db, patient, current_user=current_user)
        # else: no department/consult_fee resolved yet — leave payment_status=pending;
        # receptionist can trigger POST /api/payments/initiate once assigned.

    record_audit(
        db,
        user_id=current_user.id,
        action="create",
        entity="patients",
        entity_id=patient.id,
        new_value={"intake_channel": patient.intake_channel.value, "profile_status": patient.profile_status.value},
    )
    db.commit()
    db.refresh(patient)
    return patient


# ---------------------------------------------------------------------------
# List / get
# ---------------------------------------------------------------------------


def list_patients(db: Session, *, status: ProfileStatus | None = None) -> list[Patient]:
    stmt = select(Patient).order_by(Patient.created_at.desc())
    if status is not None:
        stmt = stmt.where(Patient.profile_status == status)
    return list(db.execute(stmt).scalars().all())


def get_patient(db: Session, patient_id: uuid.UUID) -> Patient | None:
    return db.get(Patient, patient_id)


# ---------------------------------------------------------------------------
# Partial update (used by /confirm before activation)
# ---------------------------------------------------------------------------

_EDITABLE_FIELDS = (
    "full_name",
    "date_of_birth",
    "gender",
    "id_number",
    "blood_group",
    "mobile",
    "email",
    "address",
    "emergency_name",
    "emergency_phone",
    "admission_type",
    "chief_complaint",
    "medico_legal",
    "doctor_id",
    "department_id",
    "consult_fee",
)


def apply_patient_update(patient: Patient, updates: PatientUpdate) -> bool:
    """Applies a partial update to `patient`. Returns True if the receptionist
    explicitly supplied a doctor_id override (so callers can skip re-running
    auto-assignment). Raises PatientError on a write-once fir_number violation."""
    data = updates.model_dump(exclude_unset=True)

    if "fir_number" in data and data["fir_number"] is not None:
        if patient.fir_number is not None:
            raise PatientError("fir_number is write-once and cannot be changed", 400)
        patient.fir_number = data["fir_number"]

    for field in _EDITABLE_FIELDS:
        if field in data and data[field] is not None:
            setattr(patient, field, data[field])

    if patient.medico_legal and not patient.fir_number:
        raise PatientError("fir_number is required when medico_legal is true", 400)

    return "doctor_id" in data and data["doctor_id"] is not None


# ---------------------------------------------------------------------------
# Activation (shared by /activate and /confirm)
# ---------------------------------------------------------------------------


def _consume_otp(db: Session, *, mobile: str, code: str) -> bool:
    otp = db.execute(
        select(OtpCode)
        .where(
            OtpCode.mobile == mobile,
            OtpCode.purpose == "verify_mobile",
            OtpCode.code == code,
            OtpCode.consumed_at.is_(None),
        )
        .order_by(OtpCode.created_at.desc())
    ).scalars().first()
    if otp is None or otp.expires_at < _utcnow():
        return False
    otp.consumed_at = _utcnow()
    otp.verified = True
    return True


def _reject_if_duplicate_active_today(db: Session, patient: Patient) -> None:
    today = _utcnow().date()
    rows = db.execute(
        select(Patient).where(
            Patient.mobile == patient.mobile,
            Patient.id != patient.id,
            Patient.profile_status == ProfileStatus.active,
        )
    ).scalars().all()
    for row in rows:
        if row.admitted_at is not None and row.admitted_at.date() == today:
            raise PatientError("This patient already has an active profile today", 409)


def activate_patient(
    db: Session,
    patient: Patient,
    *,
    otp_code: str | None,
    current_user: User,
    skip_auto_assign: bool = False,
) -> Patient:
    """Shared activation logic for PATCH /activate and PATCH /confirm."""
    if patient.profile_status not in (ProfileStatus.draft, ProfileStatus.pending):
        raise PatientError("Only draft or pending profiles can be activated", 409)

    if not patient.mobile_verified:
        if not otp_code:
            raise PatientError("otp_code is required — mobile must be OTP-verified before activation", 400)
        if not _consume_otp(db, mobile=patient.mobile, code=otp_code):
            raise PatientError("Invalid or expired OTP code", 400)
        patient.mobile_verified = True

    _reject_if_duplicate_active_today(db, patient)

    old_status = patient.profile_status.value
    patient.profile_status = ProfileStatus.active
    patient.admitted_at = _utcnow()

    if not skip_auto_assign:
        run_auto_assignment(db, patient)

    if patient.payment_status not in (PaymentStatus.deferred, PaymentStatus.paid, PaymentStatus.waived):
        if patient.consult_fee is not None:
            initiate_payment(db, patient, current_user=current_user)

    record_audit(
        db,
        user_id=current_user.id,
        action="activate",
        entity="patients",
        entity_id=patient.id,
        old_value={"profile_status": old_status},
        new_value={"profile_status": patient.profile_status.value},
    )
    return patient


def confirm_patient(
    db: Session,
    patient: Patient,
    *,
    otp_code: str | None,
    updates: PatientUpdate | None,
    current_user: User,
) -> Patient:
    if patient.profile_status not in (ProfileStatus.draft, ProfileStatus.pending):
        raise PatientError("Only draft or pending profiles can be confirmed", 409)

    skip_auto_assign = False
    if updates is not None:
        skip_auto_assign = apply_patient_update(patient, updates)

    return activate_patient(
        db, patient, otp_code=otp_code, current_user=current_user, skip_auto_assign=skip_auto_assign
    )
