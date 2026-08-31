// Mirrors app/modules/patient_app/schemas.py on the backend.

export type Route = "oral" | "IV" | "IM" | "topical" | "inhalation";

export type Frequency =
  | "once_daily"
  | "twice_daily"
  | "thrice_daily"
  | "every_6h"
  | "every_8h"
  | "as_needed";

export type AlertStatus =
  | "SCHEDULED"
  | "FIRED"
  | "ACKNOWLEDGED"
  | "GIVEN"
  | "MISSED"
  | "CANCELLED";

export interface RegisterResponse {
  access_token: string;
  token_type: string;
  role: string;
  user_id: string;
  patient_id: string;
  full_name: string;
}

export interface PrescriptionLine {
  id: string;
  medicine_name: string;
  dosage: string;
  route: Route;
  frequency: Frequency;
  start_date: string;
  duration_days: number;
  with_food: boolean;
  special_instructions: string | null;
}

export interface ActivePrescription {
  id: string;
  patient_id: string;
  doctor_id: string;
  version: number;
  notes: string | null;
  created_at: string;
  lines: PrescriptionLine[];
}

export interface PatientAlert {
  id: string;
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
}

export interface AlertTaken {
  id: string;
  status: AlertStatus;
}

export interface MedicationHistoryEntry {
  id: string;
  alert_id: string;
  prescription_line_id: string;
  medicine_name: string | null;
  administered_at: string;
  dose_given: string | null;
  route_used: Route | null;
  skipped: boolean;
  skip_reason: string | null;
  notes: string | null;
}
