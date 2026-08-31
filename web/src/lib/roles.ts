export type Role =
  | "admin"
  | "receptionist"
  | "doctor"
  | "head_nurse"
  | "lab_staff"
  | "pharmacist"
  | "patient";

export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  receptionist: "/reception",
  doctor: "/doctor",
  head_nurse: "/nurse",
  lab_staff: "/lab",
  pharmacist: "/pharmacy",
  patient: "/login", // patient role only uses the mobile app
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Super Administrator",
  receptionist: "Receptionist",
  doctor: "Doctor",
  head_nurse: "Head Nurse",
  lab_staff: "Lab Staff",
  pharmacist: "Pharmacist",
  patient: "Patient",
};
