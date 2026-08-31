import { apiClient } from "@/api/client";

export type Gender = "M" | "F" | "Other";
export type IntakeChannel = "emergency" | "phone" | "website";
export type ProfileStatus = "draft" | "pending" | "active" | "discharged" | "expired";
export type AdmissionType = "inpatient" | "outpatient" | "day-care";
export type PaymentMethod = "online" | "offline";
export type PaymentStatus = "pending" | "link_sent" | "paid" | "deferred" | "waived";

export interface Patient {
  id: string;
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  id_number: string;
  blood_group: string | null;
  mobile: string;
  mobile_verified: boolean;
  email: string | null;
  address: string | null;
  emergency_name: string;
  emergency_phone: string;
  intake_channel: IntakeChannel;
  profile_status: ProfileStatus;
  admission_type: AdmissionType;
  chief_complaint: string;
  medico_legal: boolean;
  fir_number: string | null;
  department_id: string | null;
  doctor_id: string | null;
  ward: string | null;
  admitted_at: string | null;
  consult_fee: number | null;
  payment_method: PaymentMethod | null;
  payment_status: PaymentStatus;
  payment_link: string | null;
  payment_link_expires: string | null;
  receipt_number: string | null;
  collected_by: string | null;
  discharged_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Slimmer row shape returned by GET /api/patients (list view). */
export type PatientListItem = Pick<
  Patient,
  | "id"
  | "full_name"
  | "mobile"
  | "gender"
  | "intake_channel"
  | "profile_status"
  | "admission_type"
  | "department_id"
  | "doctor_id"
  | "payment_status"
  | "admitted_at"
  | "discharged_at"
  | "created_at"
>;

export interface PatientCreatePayload {
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  id_number: string;
  blood_group?: string | null;
  mobile: string;
  email?: string | null;
  address?: string | null;
  emergency_name: string;
  emergency_phone: string;
  intake_channel: IntakeChannel;
  admission_type: AdmissionType;
  chief_complaint: string;
  medico_legal: boolean;
  fir_number?: string | null;
  defer_payment?: boolean;
}

export async function listPatients(status?: ProfileStatus): Promise<PatientListItem[]> {
  const { data } = await apiClient.get<PatientListItem[]>("/api/patients", {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function getPatient(id: string): Promise<Patient> {
  const { data } = await apiClient.get<Patient>(`/api/patients/${id}`);
  return data;
}

export async function createPatient(payload: PatientCreatePayload): Promise<Patient> {
  const { data } = await apiClient.post<Patient>("/api/patients", payload);
  return data;
}

export async function activatePatient(id: string, otp_code: string): Promise<Patient> {
  const { data } = await apiClient.patch<Patient>(`/api/patients/${id}/activate`, { otp_code });
  return data;
}

export async function confirmPatient(id: string, otp_code: string): Promise<Patient> {
  const { data } = await apiClient.patch<Patient>(`/api/patients/${id}/confirm`, { otp_code });
  return data;
}

export async function assignPatient(patient_id: string): Promise<Patient> {
  const { data } = await apiClient.post<Patient>("/api/assign", { patient_id });
  return data;
}

export async function initiatePayment(patient_id: string): Promise<Patient> {
  const { data } = await apiClient.post<Patient>("/api/payments/initiate", { patient_id });
  return data;
}

export async function recordOfflinePayment(patient_id: string, receipt_number: string): Promise<Patient> {
  const { data } = await apiClient.patch<Patient>("/api/payments/offline", { patient_id, receipt_number });
  return data;
}

export async function sendOtp(mobile: string, purpose = "verify_mobile"): Promise<void> {
  await apiClient.post("/api/auth/otp/send", { mobile, purpose });
}
