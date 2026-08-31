import { apiClient } from "./client";
import type {
  ActivePrescription,
  AlertTaken,
  MedicationHistoryEntry,
  PatientAlert,
  RegisterResponse,
} from "./types";

export async function sendOtp(mobile: string): Promise<void> {
  await apiClient.post("/api/auth/otp/send", { mobile, purpose: "verify_mobile" });
}

export async function registerPatient(
  patientId: string,
  mobile: string,
  otpCode: string
): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>("/api/patient/register", {
    patient_id: patientId,
    mobile,
    otp_code: otpCode,
  });
  return data;
}

export async function fetchActivePrescription(): Promise<ActivePrescription> {
  const { data } = await apiClient.get<ActivePrescription>("/api/patient/prescriptions/active");
  return data;
}

export async function fetchAlertsToday(): Promise<PatientAlert[]> {
  const { data } = await apiClient.get<PatientAlert[]>("/api/patient/alerts/today");
  return data;
}

export async function markAlertTaken(alertId: string): Promise<AlertTaken> {
  const { data } = await apiClient.patch<AlertTaken>(`/api/patient/alerts/${alertId}/taken`);
  return data;
}

export async function fetchHistory(): Promise<MedicationHistoryEntry[]> {
  const { data } = await apiClient.get<MedicationHistoryEntry[]>("/api/patient/history");
  return data;
}
