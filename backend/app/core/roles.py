import enum


class Role(str, enum.Enum):
    admin = "admin"
    receptionist = "receptionist"
    doctor = "doctor"
    head_nurse = "head_nurse"
    lab_staff = "lab_staff"
    pharmacist = "pharmacist"
    patient = "patient"


ALL_ROLES = tuple(r.value for r in Role)
