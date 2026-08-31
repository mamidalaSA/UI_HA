import { apiClient } from "@/api/client";

// ---- Shared enums (mirror app/modules/doctors/models.py Route and
// app/modules/alerts/models.py AlertStatus on the backend) ----
export type Route = "oral" | "IV" | "IM" | "topical" | "inhalation";
export type AlertStatus = "SCHEDULED" | "FIRED" | "ACKNOWLEDGED" | "GIVEN" | "MISSED" | "CANCELLED";

// ---- GET /api/nurse/alerts ----
export interface NurseAlert {
  id: string;
  patient_id: string;
  patient_name: string;
  ward: string | null;
  prescription_line_id: string;
  medicine_name: string;
  dosage: string;
  route: Route;
  with_food: boolean;
  special_instructions: string | null;
  scheduled_date: string;
  slot_time: string;
  fire_at: string;
  expire_at: string;
  status: AlertStatus;
  acknowledged_at: string | null;
}

export async function fetchNurseAlerts(): Promise<NurseAlert[]> {
  const { data } = await apiClient.get<NurseAlert[]>("/api/nurse/alerts");
  return data;
}

// ---- PATCH /api/alerts/:id/acknowledge ----
export interface AlertAcknowledgeResult {
  id: string;
  status: AlertStatus;
  acknowledged_at: string | null;
}

export async function acknowledgeAlert(alertId: string): Promise<AlertAcknowledgeResult> {
  const { data } = await apiClient.patch<AlertAcknowledgeResult>(`/api/alerts/${alertId}/acknowledge`);
  return data;
}

// ---- POST /api/alerts/:id/log ----
export interface MedicationLogCreatePayload {
  dose_given?: string | null;
  route_used?: Route | null;
  skipped: boolean;
  skip_reason?: string | null;
  notes?: string | null;
}

export interface MedicationLog {
  id: string;
  alert_id: string;
  prescription_line_id: string;
  patient_id: string;
  administered_by: string;
  administered_at: string;
  dose_given: string | null;
  route_used: Route | null;
  skipped: boolean;
  skip_reason: string | null;
  notes: string | null;
}

export async function logDose(alertId: string, payload: MedicationLogCreatePayload): Promise<MedicationLog> {
  const { data } = await apiClient.post<MedicationLog>(`/api/alerts/${alertId}/log`, payload);
  return data;
}

// ---- POST/GET /api/patients/:id/vitals ----
export interface VitalsCreatePayload {
  temperature_c?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  pulse_bpm?: number | null;
  spo2_pct?: number | null;
  resp_rate?: number | null;
  blood_glucose?: number | null;
  gcs_score?: number | null;
}

export interface Vitals extends VitalsCreatePayload {
  id: string;
  patient_id: string;
  recorded_by: string;
  recorded_at: string;
  flagged: boolean;
  flag_reason: string | null;
}

export async function recordVitals(patientId: string, payload: VitalsCreatePayload): Promise<Vitals> {
  const { data } = await apiClient.post<Vitals>(`/api/patients/${patientId}/vitals`, payload);
  return data;
}

export async function fetchVitalsHistory(patientId: string): Promise<Vitals[]> {
  const { data } = await apiClient.get<Vitals[]>(`/api/patients/${patientId}/vitals`);
  return data;
}

// ---- GET /api/patients/:id/medication-log ----
export async function fetchMedicationLog(patientId: string): Promise<MedicationLog[]> {
  const { data } = await apiClient.get<MedicationLog[]>(`/api/patients/${patientId}/medication-log`);
  return data;
}

// ---- POST /api/escalations ----
export interface EscalationResult {
  sent: boolean;
  patient_id: string;
  doctor_user_id: string | null;
}

export async function createEscalation(patientId: string, message: string): Promise<EscalationResult> {
  const { data } = await apiClient.post<EscalationResult>("/api/escalations", {
    patient_id: patientId,
    message,
  });
  return data;
}

// ---- Derived "my patients" list ----
// NOTE: the spec's Head Nurse endpoint list has no dedicated "list patients in my ward"
// endpoint — only GET /api/nurse/alerts (active dose alerts) is ward-scoped. So "My
// Patients" and the Observation patient picker are both derived from the distinct
// patients that currently have an active alert. A patient with no pending dose alert
// (e.g. all doses already given) will not appear here until their next alert fires.
export interface WardPatientSummary {
  patient_id: string;
  patient_name: string;
  ward: string | null;
  active_alert_count: number;
}

export function patientsFromAlerts(alerts: NurseAlert[]): WardPatientSummary[] {
  const byId = new Map<string, WardPatientSummary>();
  for (const alert of alerts) {
    const existing = byId.get(alert.patient_id);
    if (existing) {
      existing.active_alert_count += 1;
    } else {
      byId.set(alert.patient_id, {
        patient_id: alert.patient_id,
        patient_name: alert.patient_name,
        ward: alert.ward,
        active_alert_count: 1,
      });
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.patient_name.localeCompare(b.patient_name));
}
