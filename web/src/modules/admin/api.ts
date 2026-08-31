import { apiClient } from "@/api/client";
import type { Role } from "@/lib/roles";

// ---------------------------------------------------------------------------
// Shared/basic types
// ---------------------------------------------------------------------------

export type Gender = "M" | "F" | "Other";
export type IntakeChannel = "emergency" | "phone" | "website";
export type ProfileStatus = "draft" | "pending" | "active" | "discharged" | "expired";
export type AdmissionType = "inpatient" | "outpatient" | "day-care";
export type PaymentStatus = "pending" | "link_sent" | "paid" | "deferred" | "waived";

export interface Patient {
  id: string;
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  mobile: string;
  intake_channel: IntakeChannel;
  profile_status: ProfileStatus;
  admission_type: AdmissionType;
  department_id: string | null;
  doctor_id: string | null;
  payment_status: PaymentStatus;
  admitted_at: string | null;
  discharged_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
  is_active: boolean;
  ward: string | null;
  created_at: string;
}

export interface UserCreatePayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string | null;
  role: Role;
  department_id?: string | null;
  specialty?: string | null;
  ward?: string | null;
}

export interface UserUpdatePayload {
  full_name?: string;
  phone?: string;
  is_active?: boolean;
  role?: Role;
}

export async function listUsers(role?: Role): Promise<User[]> {
  const { data } = await apiClient.get("/api/admin/users", { params: role ? { role } : {} });
  return data;
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const { data } = await apiClient.post("/api/admin/users", payload);
  return data;
}

export async function updateUser(id: string, payload: UserUpdatePayload): Promise<User> {
  const { data } = await apiClient.patch(`/api/admin/users/${id}`, payload);
  return data;
}

// ---------------------------------------------------------------------------
// Doctors (read-only convenience listing — bridges User <-> Doctor.id)
// ---------------------------------------------------------------------------

export interface Doctor {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  department_id: string;
  specialty: string;
}

export async function listDoctors(): Promise<Doctor[]> {
  const { data } = await apiClient.get("/api/admin/doctors");
  return data;
}

// ---------------------------------------------------------------------------
// Departments
// ---------------------------------------------------------------------------

export interface Department {
  id: string;
  name: string;
  code: string;
  created_at: string;
  updated_at: string;
}

export async function listDepartments(): Promise<Department[]> {
  const { data } = await apiClient.get("/api/admin/departments");
  return data;
}

export async function createDepartment(payload: { name: string; code: string }): Promise<Department> {
  const { data } = await apiClient.post("/api/admin/departments", payload);
  return data;
}

export async function updateDepartment(
  id: string,
  payload: { name?: string; code?: string }
): Promise<Department> {
  const { data } = await apiClient.patch(`/api/admin/departments/${id}`, payload);
  return data;
}

// ---------------------------------------------------------------------------
// Department fees
// ---------------------------------------------------------------------------

export interface DepartmentFee {
  id: string;
  department_id: string;
  consult_fee: number;
}

export async function listDepartmentFees(): Promise<DepartmentFee[]> {
  const { data } = await apiClient.get("/api/admin/department-fees");
  return data;
}

export async function upsertDepartmentFee(departmentId: string, consult_fee: number): Promise<DepartmentFee> {
  const { data } = await apiClient.put(`/api/admin/department-fees/${departmentId}`, { consult_fee });
  return data;
}

// ---------------------------------------------------------------------------
// Specialty mapping
// ---------------------------------------------------------------------------

export interface SpecialtyMapping {
  id: string;
  keyword: string;
  specialty: string;
}

export async function listSpecialtyMapping(): Promise<SpecialtyMapping[]> {
  const { data } = await apiClient.get("/api/admin/specialty-mapping");
  return data;
}

export async function createSpecialtyMapping(payload: { keyword: string; specialty: string }): Promise<SpecialtyMapping> {
  const { data } = await apiClient.post("/api/admin/specialty-mapping", payload);
  return data;
}

export async function deleteSpecialtyMapping(id: string): Promise<void> {
  await apiClient.delete(`/api/admin/specialty-mapping/${id}`);
}

// ---------------------------------------------------------------------------
// Department specialty
// ---------------------------------------------------------------------------

export interface DepartmentSpecialty {
  id: string;
  specialty: string;
  department_id: string;
}

export async function listDepartmentSpecialty(): Promise<DepartmentSpecialty[]> {
  const { data } = await apiClient.get("/api/admin/department-specialty");
  return data;
}

export async function createDepartmentSpecialty(payload: {
  specialty: string;
  department_id: string;
}): Promise<DepartmentSpecialty> {
  const { data } = await apiClient.post("/api/admin/department-specialty", payload);
  return data;
}

// ---------------------------------------------------------------------------
// Doctor roster
// ---------------------------------------------------------------------------

export interface DoctorRoster {
  id: string;
  doctor_id: string;
  day_of_week: number;
  is_on_duty: boolean;
  max_patients: number;
}

export async function listDoctorRoster(doctorId?: string): Promise<DoctorRoster[]> {
  const { data } = await apiClient.get("/api/admin/doctor-roster", {
    params: doctorId ? { doctor_id: doctorId } : {},
  });
  return data;
}

export async function upsertDoctorRoster(payload: {
  doctor_id: string;
  day_of_week: number;
  is_on_duty: boolean;
  max_patients: number;
}): Promise<DoctorRoster> {
  const { data } = await apiClient.post("/api/admin/doctor-roster", payload);
  return data;
}

// ---------------------------------------------------------------------------
// Test catalogue
// ---------------------------------------------------------------------------

export interface TestCatalogueEntry {
  id: string;
  name: string;
  department_id: string;
  category: string;
  tat_min_hours: number;
  tat_max_hours: number;
}

export async function listTestCatalogue(): Promise<TestCatalogueEntry[]> {
  const { data } = await apiClient.get("/api/admin/test-catalogue");
  return data;
}

export async function createTestCatalogueEntry(payload: {
  name: string;
  department_id: string;
  category: string;
  tat_min_hours: number;
  tat_max_hours: number;
}): Promise<TestCatalogueEntry> {
  const { data } = await apiClient.post("/api/admin/test-catalogue", payload);
  return data;
}

export async function updateTestCatalogueEntry(
  id: string,
  payload: Partial<{
    name: string;
    department_id: string;
    category: string;
    tat_min_hours: number;
    tat_max_hours: number;
  }>
): Promise<TestCatalogueEntry> {
  const { data } = await apiClient.patch(`/api/admin/test-catalogue/${id}`, payload);
  return data;
}

// ---------------------------------------------------------------------------
// Medicine formulary
// ---------------------------------------------------------------------------

export interface MedicineFormularyEntry {
  id: string;
  name: string;
  default_dosage: string | null;
  is_approved: boolean;
}

export async function listMedicineFormulary(): Promise<MedicineFormularyEntry[]> {
  const { data } = await apiClient.get("/api/admin/medicine-formulary");
  return data;
}

export async function createMedicineFormularyEntry(payload: {
  name: string;
  default_dosage?: string | null;
  is_approved: boolean;
}): Promise<MedicineFormularyEntry> {
  const { data } = await apiClient.post("/api/admin/medicine-formulary", payload);
  return data;
}

export async function updateMedicineFormularyEntry(
  id: string,
  payload: Partial<{ name: string; default_dosage: string | null; is_approved: boolean }>
): Promise<MedicineFormularyEntry> {
  const { data } = await apiClient.patch(`/api/admin/medicine-formulary/${id}`, payload);
  return data;
}

// ---------------------------------------------------------------------------
// Vitals config
// ---------------------------------------------------------------------------

export interface VitalsConfigEntry {
  id: string;
  vital_name: string;
  min_value: number;
  max_value: number;
}

export async function listVitalsConfig(): Promise<VitalsConfigEntry[]> {
  const { data } = await apiClient.get("/api/admin/vitals-config");
  return data;
}

export async function upsertVitalsConfig(
  vitalName: string,
  payload: { min_value: number; max_value: number }
): Promise<VitalsConfigEntry> {
  const { data } = await apiClient.put(`/api/admin/vitals-config/${vitalName}`, payload);
  return data;
}

// ---------------------------------------------------------------------------
// Alert window config
// ---------------------------------------------------------------------------

export interface AlertWindowConfig {
  id: string;
  fire_before_minutes: number;
  expire_after_minutes: number;
}

export async function getAlertWindowConfig(): Promise<AlertWindowConfig | null> {
  const { data } = await apiClient.get("/api/admin/alert-window-config");
  return data;
}

export async function upsertAlertWindowConfig(payload: {
  fire_before_minutes: number;
  expire_after_minutes: number;
}): Promise<AlertWindowConfig> {
  const { data } = await apiClient.put("/api/admin/alert-window-config", payload);
  return data;
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditLogPage {
  items: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
}

export async function listAuditLog(params: {
  entity?: string;
  user_id?: string;
  page?: number;
  page_size?: number;
}): Promise<AuditLogPage> {
  const { data } = await apiClient.get("/api/admin/audit-log", { params });
  return data;
}

// ---------------------------------------------------------------------------
// Dev debug
// ---------------------------------------------------------------------------

export async function getSmsOutbox(): Promise<Array<{ to: string; message: string }>> {
  const { data } = await apiClient.get("/api/admin/dev/sms-outbox");
  return data;
}

export async function getPushOutbox(): Promise<
  Array<{ user_id: string; title: string; body: string; data: Record<string, unknown> }>
> {
  const { data } = await apiClient.get("/api/admin/dev/push-outbox");
  return data;
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface DepartmentBreakdownItem {
  department_id: string | null;
  department_name: string | null;
  count: number;
}

export interface GenderBreakdownItem {
  gender: string;
  count: number;
}

export interface ReportsSummary {
  total_patients: number;
  admitted_patients: number;
  discharged_patients: number;
  total_doctors: number;
  total_nurses: number;
  by_department: DepartmentBreakdownItem[];
  by_gender: GenderBreakdownItem[];
}

export async function getReportsSummary(): Promise<ReportsSummary> {
  const { data } = await apiClient.get("/api/admin/reports/summary");
  return data;
}

// ---------------------------------------------------------------------------
// Patients (read-only reuse of reception's endpoint — GET /api/patients)
// ---------------------------------------------------------------------------

export async function listPatients(): Promise<Patient[]> {
  const { data } = await apiClient.get("/api/patients");
  return data;
}
