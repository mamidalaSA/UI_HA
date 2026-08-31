import { apiClient } from "@/api/client";
import type {
  DischargeResult,
  DoctorPatientListResponse,
  ExaminationNote,
  IncomingTransfer,
  Prescription,
  PrescriptionLineInput,
  TestOrder,
  TransferRequest,
} from "./types";

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
}

export const doctorApi = {
  listPatients: () => apiClient.get<DoctorPatientListResponse>("/api/doctor/patients").then((r) => r.data),

  // Owned by the Admin module's router, but readable by any authenticated staff role
  // (reference-data GETs there aren't admin-gated) — used to populate the transfer
  // modal's department picker with real IDs instead of names.
  listDepartments: () => apiClient.get<DepartmentOption[]>("/api/admin/departments").then((r) => r.data),

  getNotes: (patientId: string) =>
    apiClient.get<ExaminationNote[]>(`/api/patients/${patientId}/notes`).then((r) => r.data),
  addNote: (patientId: string, noteText: string) =>
    apiClient.post<ExaminationNote>(`/api/patients/${patientId}/notes`, { note_text: noteText }).then((r) => r.data),

  getTests: (patientId: string) => apiClient.get<TestOrder[]>(`/api/patients/${patientId}/tests`).then((r) => r.data),
  orderTest: (patientId: string, testTypeId: string, notes?: string) =>
    apiClient
      .post<TestOrder>(`/api/patients/${patientId}/tests`, { test_type_id: testTypeId, notes })
      .then((r) => r.data),
  reviewTest: (testOrderId: string) => apiClient.patch<TestOrder>(`/api/tests/${testOrderId}/review`).then((r) => r.data),

  getPrescriptions: (patientId: string) =>
    apiClient.get<Prescription[]>(`/api/patients/${patientId}/prescriptions`).then((r) => r.data),
  savePrescription: (patientId: string, payload: { notes?: string; lines: PrescriptionLineInput[] }) =>
    apiClient.post<Prescription>(`/api/patients/${patientId}/prescriptions`, payload).then((r) => r.data),

  discharge: (patientId: string) =>
    apiClient.patch<DischargeResult>(`/api/patients/${patientId}/discharge`).then((r) => r.data),

  // The endpoints below belong to the Transfers module (implemented by a separate
  // agent). They're called directly per the task's scope boundary — this module
  // never implements them.
  transferPatient: (patientId: string, payload: TransferRequest) =>
    apiClient.post(`/api/patients/${patientId}/transfer`, payload).then((r) => r.data),
  incomingTransfers: () =>
    apiClient.get<IncomingTransfer[] | { transfers: IncomingTransfer[] }>("/api/doctor/transfers/incoming").then((r) => {
      const data = r.data;
      return Array.isArray(data) ? data : data.transfers ?? [];
    }),
  acceptTransfer: (transferId: string) => apiClient.patch(`/api/transfers/${transferId}/accept`).then((r) => r.data),
  declineTransfer: (transferId: string, declineReason: string) =>
    apiClient.patch(`/api/transfers/${transferId}/decline`, { decline_reason: declineReason }).then((r) => r.data),
};
