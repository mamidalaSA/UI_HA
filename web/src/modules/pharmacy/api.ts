import { apiClient } from "@/api/client";

export type DispenseStatus = "pending" | "out_of_stock" | "dispensed";
export type BillingPaymentStatus = "pending" | "paid" | "waived";

export interface PrescriptionLine {
  id: string;
  medicine_name: string;
  dosage: string;
  route: string;
  frequency: string;
  start_date: string;
  duration_days: number;
  with_food: boolean;
  special_instructions: string | null;
}

export interface QueueItem {
  id: string; // PharmacyPrescription id — pass this to dispense()
  prescription_id: string;
  patient_id: string;
  patient_name: string;
  ward: string | null;
  admitted_at: string | null;
  status: DispenseStatus;
  lines: PrescriptionLine[];
}

export interface ShortageItem {
  medicine_name: string;
  required_quantity: number;
  available_quantity: number;
}

export interface DispenseResponse {
  status: DispenseStatus;
  dispensed_lines: number;
  total_amount: number;
  payment_status: BillingPaymentStatus | null;
  receipt_number: string | null;
  shortages: ShortageItem[];
}

export interface StockItem {
  id: string;
  medicine_name: string;
  batch_number: string;
  expiry_date: string;
  quantity: number;
  min_threshold: number;
  unit_price: number;
  is_expired_flagged: boolean;
}

export interface StockItemUpdate {
  quantity?: number;
  min_threshold?: number;
  unit_price?: number;
  batch_number?: string;
  expiry_date?: string;
}

export type ReturnKind = "return" | "wastage";

export interface ReturnRequest {
  stock_item_id: string;
  quantity: number;
  kind: ReturnKind;
  notes?: string | null;
}

export interface DispenseLog {
  id: string;
  pharmacy_prescription_id: string | null;
  stock_item_id: string;
  quantity: number;
  kind: string;
  notes: string | null;
  dispensed_at: string;
}

/** Shape of the 409 response body FastAPI sends back for HTTPException(detail={...}). */
export interface DispenseConflict {
  message: string;
  shortages: ShortageItem[];
}

export async function fetchQueue(): Promise<QueueItem[]> {
  const { data } = await apiClient.get<QueueItem[]>("/api/pharmacy/queue");
  return data;
}

export async function dispenseRx(rxId: string, receiptNumber?: string): Promise<DispenseResponse> {
  const { data } = await apiClient.patch<DispenseResponse>(`/api/pharmacy/${rxId}/dispense`, {
    receipt_number: receiptNumber || undefined,
  });
  return data;
}

export async function fetchStock(): Promise<StockItem[]> {
  const { data } = await apiClient.get<StockItem[]>("/api/pharmacy/stock");
  return data;
}

export async function fetchLowStock(): Promise<StockItem[]> {
  const { data } = await apiClient.get<StockItem[]>("/api/pharmacy/stock/low");
  return data;
}

export async function updateStock(id: string, payload: StockItemUpdate): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(`/api/pharmacy/stock/${id}`, payload);
  return data;
}

export async function postReturn(payload: ReturnRequest): Promise<DispenseLog> {
  const { data } = await apiClient.post<DispenseLog>("/api/pharmacy/returns", payload);
  return data;
}

export interface PatientMedicineHistoryItem {
  id: string;
  medicine_name: string;
  quantity: number | null;
  amount: number;
  payment_status: BillingPaymentStatus;
  receipt_number: string | null;
  dispensed_at: string;
  paid_at: string | null;
}

export interface PendingBill {
  patient_id: string;
  patient_name: string;
  pending_amount: number;
  pending_entries: number;
  last_dispensed_at: string;
}

export interface CollectBillResponse {
  patient_id: string;
  collected_amount: number;
  entries_collected: number;
  receipt_number: string;
}

export interface PatientBillingSummary {
  patient_id: string;
  patient_name: string;
  total_entries: number;
  pending_amount: number;
  paid_amount: number;
  last_dispensed_at: string;
}

export async function fetchPatientsWithHistory(search?: string): Promise<PatientBillingSummary[]> {
  const { data } = await apiClient.get<PatientBillingSummary[]>("/api/pharmacy/patients", {
    params: search ? { q: search } : undefined,
  });
  return data;
}

export async function fetchPatientHistory(patientId: string): Promise<PatientMedicineHistoryItem[]> {
  const { data } = await apiClient.get<PatientMedicineHistoryItem[]>(`/api/pharmacy/patients/${patientId}/history`);
  return data;
}

export async function fetchPendingBills(): Promise<PendingBill[]> {
  const { data } = await apiClient.get<PendingBill[]>("/api/pharmacy/billing/pending");
  return data;
}

export async function collectBill(patientId: string, receiptNumber: string): Promise<CollectBillResponse> {
  const { data } = await apiClient.patch<CollectBillResponse>(`/api/pharmacy/patients/${patientId}/billing/collect`, {
    receipt_number: receiptNumber,
  });
  return data;
}
