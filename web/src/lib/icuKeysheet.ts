import { apiClient } from "@/api/client";

export interface ICUVitalsReading {
  id: string;
  recorded_at: string;
  temperature_c: number | null;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  pulse_bpm: number | null;
  spo2_pct: number | null;
  resp_rate: number | null;
  blood_glucose: number | null;
  gcs_score: number | null;
  flagged: boolean;
  flag_reason: string | null;
  notes: string | null;
}

export interface ICUKeysheetPatient {
  patient_id: string;
  full_name: string;
  ward: string | null;
  doctor_name: string | null;
  admitted_at: string | null;
  vitals: ICUVitalsReading[];
}

/** Same endpoint for every role — nurse (own ward), doctor (own patients), and
 * admin (everyone) all read the one consolidated ICU Key Sheet, scoped
 * server-side, so what a nurse charts is exactly what a doctor/admin monitors. */
export async function fetchIcuKeysheet(): Promise<ICUKeysheetPatient[]> {
  const { data } = await apiClient.get<ICUKeysheetPatient[]>("/api/icu-keysheet");
  return data;
}
