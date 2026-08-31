export type Gender = "M" | "F" | "Other";
export type AdmissionType = "inpatient" | "outpatient" | "day-care";
export type ProfileStatus = "draft" | "pending" | "active" | "discharged" | "expired";

export interface DoctorPatient {
  id: string;
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  admission_type: AdmissionType;
  profile_status: ProfileStatus;
  ward: string | null;
  admitted_at: string | null;
  last_note_at: string | null;
}

export interface DoctorPatientListResponse {
  patients: DoctorPatient[];
  pending_reports_count: number;
}

export interface ExaminationNote {
  id: string;
  patient_id: string;
  doctor_id: string;
  note_text: string;
  created_at: string;
}

export type TestOrderStatus = "pending" | "in_progress" | "completed" | "reviewed" | "cancelled";

export interface TestOrder {
  id: string;
  patient_id: string;
  doctor_id: string;
  test_type_id: string;
  status: TestOrderStatus;
  ordered_at: string;
  result_text: string | null;
  result_file_url: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  notes: string | null;
}

export type Route = "oral" | "IV" | "IM" | "topical" | "inhalation";
export type Frequency = "once_daily" | "twice_daily" | "thrice_daily" | "every_6h" | "every_8h" | "as_needed";

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

export interface PrescriptionLineInput {
  medicine_name: string;
  dosage: string;
  route: Route;
  frequency: Frequency;
  start_date: string;
  duration_days: number;
  with_food: boolean;
  special_instructions: string;
}

export interface Prescription {
  id: string;
  patient_id: string;
  doctor_id: string;
  version: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  archived_at: string | null;
  lines: PrescriptionLine[];
}

export interface DischargeResult {
  id: string;
  profile_status: ProfileStatus;
  discharged_at: string | null;
  cancelled_alert_count: number;
}

// Owned by the Transfers module (backend implemented by a separate agent). Shape is
// a best guess from the spec's patient_transfers table — kept loose/optional where
// unsure so this frontend degrades gracefully rather than crashing on a mismatch.
export type TransferUrgency = "routine" | "urgent" | "emergency";

export interface IncomingTransfer {
  id: string;
  patient_id: string;
  patient_name?: string;
  from_doctor_id?: string;
  transfer_type?: "internal" | "external";
  urgency: TransferUrgency;
  transfer_reason: string;
  handover_notes?: string | null;
  status?: string;
  initiated_at?: string;
}

export interface TransferRequest {
  transfer_type: "internal" | "external";
  to_dept_id?: string;
  to_hospital_name?: string;
  to_hospital_contact?: string;
  urgency: TransferUrgency;
  transfer_reason: string;
  handover_notes?: string;
}
