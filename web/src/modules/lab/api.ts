import { apiClient } from "@/api/client";

export type TestOrderStatus = "pending" | "in_progress" | "completed" | "reviewed" | "cancelled";

export interface TestQueueItem {
  id: string;
  patient_id: string;
  patient_name: string;
  doctor_id: string;
  test_type_id: string;
  test_name: string;
  category: string;
  status: TestOrderStatus;
  ordered_at: string;
  notes: string | null;
}

export interface TestHistoryItem {
  id: string;
  patient_id: string;
  doctor_id: string;
  test_type_id: string;
  test_name: string;
  category: string;
  status: TestOrderStatus;
  ordered_at: string;
  result_text: string | null;
  result_file_url: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  notes: string | null;
}

export async function fetchQueue(): Promise<TestQueueItem[]> {
  const { data } = await apiClient.get<TestQueueItem[]>("/api/lab/queue");
  return data;
}

export async function startProgress(testId: string): Promise<void> {
  await apiClient.patch(`/api/tests/${testId}/progress`);
}

export async function completeTest(testId: string, resultText: string, file: File | null): Promise<void> {
  const form = new FormData();
  form.append("result_text", resultText);
  if (file) {
    form.append("file", file);
  }
  await apiClient.patch(`/api/tests/${testId}/complete`, form);
}

export async function fetchPatientTests(patientId: string): Promise<TestHistoryItem[]> {
  const { data } = await apiClient.get<TestHistoryItem[]>(`/api/patients/${patientId}/tests`);
  return data;
}
