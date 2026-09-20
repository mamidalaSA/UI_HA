import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { IconSearch } from "@/components/icons";
import {
  activatePatient,
  confirmPatient,
  getPatient,
  initiatePayment,
  listDoctors,
  listPatients,
  recordOfflinePayment,
  sendOtp,
  updatePatient,
  type AdmissionType,
  type Doctor,
  type Gender,
  type Patient,
  type PatientListItem,
  type ProfileStatus,
} from "./api";
import { PAYMENT_STATUS_TONE, PROFILE_STATUS_TONE, titleCase } from "./statusStyles";
import { ReceptionShell } from "./ReceptionShell";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-reception-accent";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

interface EditFormState {
  full_name: string;
  date_of_birth: string;
  gender: Gender;
  id_number: string;
  blood_group: string;
  mobile: string;
  email: string;
  address: string;
  emergency_name: string;
  emergency_phone: string;
  admission_type: AdmissionType;
  chief_complaint: string;
  medico_legal: boolean;
  fir_number: string;
  doctor_id: string;
}

function toEditForm(p: Patient): EditFormState {
  return {
    full_name: p.full_name,
    date_of_birth: p.date_of_birth,
    gender: p.gender,
    id_number: p.id_number,
    blood_group: p.blood_group ?? "",
    mobile: p.mobile,
    email: p.email ?? "",
    address: p.address ?? "",
    emergency_name: p.emergency_name,
    emergency_phone: p.emergency_phone,
    admission_type: p.admission_type,
    chief_complaint: p.chief_complaint,
    medico_legal: p.medico_legal,
    fir_number: p.fir_number ?? "",
    doctor_id: p.doctor_id ?? "",
  };
}

const STATUS_TABS: { label: string; value: ProfileStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Discharged", value: "discharged" },
  { label: "Expired", value: "expired" },
];

export default function PatientListPage() {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProfileStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [activateTarget, setActivateTarget] = useState<PatientListItem | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);

  const [offlineTarget, setOfflineTarget] = useState<PatientListItem | null>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [offlineBusy, setOfflineBusy] = useState(false);

  const [resendingId, setResendingId] = useState<string | null>(null);

  const [editOriginal, setEditOriginal] = useState<Patient | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  useEffect(() => {
    listDoctors()
      .then((rows) => setDoctors(rows.filter((d) => d.is_active)))
      .catch(() => setDoctors([]));
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listPatients(tab === "all" ? undefined : tab);
      setPatients(data);
    } catch {
      setActionError("Could not load patients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => p.full_name.toLowerCase().includes(q) || p.mobile.includes(q));
  }, [patients, search]);

  function openActivate(p: PatientListItem) {
    setActivateTarget(p);
    setOtpCode("");
    setOtpSent(false);
    setActionError(null);
  }

  async function handleSendOtp() {
    if (!activateTarget) return;
    setOtpBusy(true);
    setActionError(null);
    try {
      await sendOtp(activateTarget.mobile, "verify_mobile");
      setOtpSent(true);
    } catch {
      setActionError("Could not send OTP.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleActivateSubmit() {
    if (!activateTarget) return;
    setOtpBusy(true);
    setActionError(null);
    try {
      if (activateTarget.profile_status === "pending") {
        await confirmPatient(activateTarget.id, otpCode);
      } else {
        await activatePatient(activateTarget.id, otpCode);
      }
      setActivateTarget(null);
      await refresh();
    } catch {
      setActionError("Activation failed — check the OTP code and try again.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleResend(p: PatientListItem) {
    setResendingId(p.id);
    setActionError(null);
    try {
      await initiatePayment(p.id);
      await refresh();
    } catch {
      setActionError("Could not resend payment link.");
    } finally {
      setResendingId(null);
    }
  }

  function openOffline(p: PatientListItem) {
    setOfflineTarget(p);
    setReceiptNumber("");
    setActionError(null);
  }

  async function handleOfflineSubmit() {
    if (!offlineTarget || !receiptNumber.trim()) return;
    setOfflineBusy(true);
    setActionError(null);
    try {
      await recordOfflinePayment(offlineTarget.id, receiptNumber.trim());
      setOfflineTarget(null);
      await refresh();
    } catch {
      setActionError("Could not record offline payment.");
    } finally {
      setOfflineBusy(false);
    }
  }

  function setEditField<K extends keyof EditFormState>(key: K, value: EditFormState[K]) {
    setEditForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function openEdit(p: PatientListItem) {
    setActionError(null);
    setEditLoading(true);
    setEditOriginal(null);
    setEditForm(null);
    try {
      const full = await getPatient(p.id);
      setEditOriginal(full);
      setEditForm(toEditForm(full));
    } catch {
      setActionError("Could not load patient details.");
    } finally {
      setEditLoading(false);
    }
  }

  function closeEdit() {
    setEditOriginal(null);
    setEditForm(null);
  }

  async function handleEditSubmit() {
    if (!editOriginal || !editForm) return;
    if (editForm.medico_legal && !editForm.fir_number.trim()) {
      setActionError("FIR number is required when Medico-Legal is toggled on.");
      return;
    }

    // Only send fields that actually changed — the backend rejects fir_number once
    // it's already set, so resending an unchanged value would fail for no reason.
    const payload: Record<string, unknown> = {};
    const original = toEditForm(editOriginal);
    (Object.keys(editForm) as (keyof EditFormState)[]).forEach((key) => {
      if (editForm[key] !== original[key]) {
        payload[key] = editForm[key] === "" ? null : editForm[key];
      }
    });
    if (!editForm.medico_legal) delete payload.fir_number;

    if (Object.keys(payload).length === 0) {
      closeEdit();
      return;
    }

    setEditBusy(true);
    setActionError(null);
    try {
      await updatePatient(editOriginal.id, payload);
      closeEdit();
      await refresh();
    } catch {
      setActionError("Could not save patient details.");
    } finally {
      setEditBusy(false);
    }
  }

  const columns: Column<PatientListItem>[] = [
    { header: "Name", render: (p) => <span className="font-medium text-slate-800">{p.full_name}</span> },
    { header: "Mobile", render: (p) => p.mobile },
    { header: "Channel", render: (p) => titleCase(p.intake_channel) },
    { header: "Status", render: (p) => <Badge tone={PROFILE_STATUS_TONE[p.profile_status]}>{titleCase(p.profile_status)}</Badge> },
    { header: "Payment", render: (p) => <Badge tone={PAYMENT_STATUS_TONE[p.payment_status]}>{titleCase(p.payment_status)}</Badge> },
    { header: "Registered", render: (p) => new Date(p.created_at).toLocaleDateString() },
    {
      header: "Actions",
      render: (p) => (
        <div className="flex flex-wrap gap-2">
          {p.profile_status !== "discharged" && p.profile_status !== "expired" && (
            <button
              onClick={() => openEdit(p)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Edit
            </button>
          )}
          {(p.profile_status === "draft" || p.profile_status === "pending") && (
            <button
              onClick={() => openActivate(p)}
              className="rounded-md bg-reception-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
            >
              Activate
            </button>
          )}
          {(p.payment_status === "link_sent" || p.payment_status === "pending") && (
            <button
              onClick={() => handleResend(p)}
              disabled={resendingId === p.id}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {resendingId === p.id ? "Sending…" : "Resend link"}
            </button>
          )}
          {p.payment_status !== "paid" && p.payment_status !== "waived" && (
            <button
              onClick={() => openOffline(p)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Record offline payment
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <ReceptionShell pageTitle="Patient List">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  tab === t.value ? "bg-reception-accent text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                } border border-slate-200`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
            <IconSearch className="h-4 w-4 text-slate-400" />
            <input
              placeholder="Search by name or mobile"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 text-sm outline-none"
            />
          </div>
        </div>

        {actionError && <p className="text-sm font-medium text-red-600">{actionError}</p>}

        <Panel title={`Patients (${filtered.length})`}>
          <DataTable columns={columns} rows={filtered} keyFor={(p) => p.id} emptyMessage={loading ? "Loading…" : "No patients found"} />
        </Panel>
      </div>

      <Modal
        open={activateTarget !== null}
        onClose={() => setActivateTarget(null)}
        title={`Activate ${activateTarget?.full_name ?? ""}`}
        footer={
          <>
            <button onClick={() => setActivateTarget(null)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={handleActivateSubmit}
              disabled={otpBusy || !otpCode}
              className="rounded-md bg-reception-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {otpBusy ? "Working…" : "Confirm activation"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Mobile must be OTP-verified before this profile can be activated. Send an OTP to{" "}
            <span className="font-semibold">{activateTarget?.mobile}</span>, then enter the code below.
          </p>
          <button
            onClick={handleSendOtp}
            disabled={otpBusy}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {otpSent ? "Resend OTP" : "Send OTP"}
          </button>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">OTP Code</label>
            <input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-reception-accent"
              placeholder="6-digit code"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={offlineTarget !== null}
        onClose={() => setOfflineTarget(null)}
        title={`Record offline payment — ${offlineTarget?.full_name ?? ""}`}
        footer={
          <>
            <button onClick={() => setOfflineTarget(null)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={handleOfflineSubmit}
              disabled={offlineBusy || !receiptNumber.trim()}
              className="rounded-md bg-reception-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {offlineBusy ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Receipt Number</label>
          <input
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-reception-accent"
            placeholder="e.g. RCPT-00231"
          />
        </div>
      </Modal>

      <Modal
        open={editLoading || editForm !== null}
        onClose={closeEdit}
        title={`Edit patient — ${editOriginal?.full_name ?? ""}`}
        footer={
          editForm && (
            <>
              <button onClick={closeEdit} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={editBusy}
                className="rounded-md bg-reception-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {editBusy ? "Saving…" : "Save changes"}
              </button>
            </>
          )
        }
      >
        {editLoading || !editForm ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Full Name</label>
              <input className={inputClass} value={editForm.full_name} onChange={(e) => setEditField("full_name", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Date of Birth</label>
              <input type="date" className={inputClass} value={editForm.date_of_birth} onChange={(e) => setEditField("date_of_birth", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Gender</label>
              <select className={inputClass} value={editForm.gender} onChange={(e) => setEditField("gender", e.target.value as Gender)}>
                <option value="M">Male</option>
                <option value="F">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Blood Group</label>
              <input className={inputClass} value={editForm.blood_group} onChange={(e) => setEditField("blood_group", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Mobile</label>
              <input className={inputClass} value={editForm.mobile} onChange={(e) => setEditField("mobile", e.target.value)} />
              {editForm.mobile !== (editOriginal ? toEditForm(editOriginal).mobile : "") && (
                <p className="mt-1 text-xs text-amber-600">Changing the mobile number will require OTP re-verification.</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} value={editForm.email} onChange={(e) => setEditField("email", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>ID Number / Aadhaar</label>
              <input className={inputClass} value={editForm.id_number} onChange={(e) => setEditField("id_number", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Address</label>
              <textarea className={inputClass} rows={2} value={editForm.address} onChange={(e) => setEditField("address", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Emergency Contact Name</label>
              <input className={inputClass} value={editForm.emergency_name} onChange={(e) => setEditField("emergency_name", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Emergency Contact Number</label>
              <input className={inputClass} value={editForm.emergency_phone} onChange={(e) => setEditField("emergency_phone", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Admission Type</label>
              <select
                className={inputClass}
                value={editForm.admission_type}
                onChange={(e) => setEditField("admission_type", e.target.value as AdmissionType)}
              >
                <option value="inpatient">Inpatient</option>
                <option value="outpatient">Outpatient</option>
                <option value="day-care">Day-care</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Assigned Doctor</label>
              <select className={inputClass} value={editForm.doctor_id} onChange={(e) => setEditField("doctor_id", e.target.value)}>
                <option value="">Unassigned</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} — {d.specialty}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Chief Complaint</label>
              <textarea className={inputClass} rows={2} value={editForm.chief_complaint} onChange={(e) => setEditField("chief_complaint", e.target.value)} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="edit_medico_legal"
                type="checkbox"
                checked={editForm.medico_legal}
                onChange={(e) => setEditField("medico_legal", e.target.checked)}
                disabled={Boolean(editOriginal?.fir_number)}
                className="h-4 w-4 rounded border-slate-300 text-reception-accent focus:ring-reception-accent"
              />
              <label htmlFor="edit_medico_legal" className="text-sm font-medium text-slate-700">
                Medico-legal case
              </label>
            </div>
            {editForm.medico_legal && (
              <div className="sm:col-span-2">
                <label className={labelClass}>FIR Number</label>
                <input
                  className={inputClass}
                  value={editForm.fir_number}
                  disabled={Boolean(editOriginal?.fir_number)}
                  onChange={(e) => setEditField("fir_number", e.target.value)}
                />
                {editOriginal?.fir_number && <p className="mt-1 text-xs text-slate-400">Cannot be edited once saved.</p>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </ReceptionShell>
  );
}
