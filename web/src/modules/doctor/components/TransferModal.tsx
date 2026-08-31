import { useEffect, useState, type FormEvent } from "react";
import { Modal } from "@/components/Modal";
import { doctorApi, type DepartmentOption } from "../api";
import type { TransferUrgency } from "../types";

interface TransferModalProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export function TransferModal({ patientId, open, onClose, onDone }: TransferModalProps) {
  const [transferType, setTransferType] = useState<"internal" | "external">("internal");
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [department, setDepartment] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalContact, setHospitalContact] = useState("");
  const [urgency, setUrgency] = useState<TransferUrgency>("routine");
  const [reason, setReason] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedReasonLength = reason.trim().length;
  const reasonTooShort = trimmedReasonLength > 0 && trimmedReasonLength < 20;

  useEffect(() => {
    if (!open) return;
    doctorApi
      .listDepartments()
      .then((depts) => {
        setDepartments(depts);
        setDepartment((current) => current || depts[0]?.id || "");
      })
      .catch(() => setDepartments([]));
  }, [open]);

  function resetAndClose() {
    setReason("");
    setHandoverNotes("");
    setHospitalName("");
    setHospitalContact("");
    setError(null);
    onClose();
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (trimmedReasonLength < 20) {
      setError("Transfer reason must be at least 20 characters.");
      return;
    }
    setSubmitting(true);
    try {
      await doctorApi.transferPatient(patientId, {
        transfer_type: transferType,
        to_dept_id: transferType === "internal" ? department : undefined,
        to_hospital_name: transferType === "external" ? hospitalName : undefined,
        to_hospital_contact: transferType === "external" ? hospitalContact : undefined,
        urgency,
        transfer_reason: reason.trim(),
        handover_notes: handoverNotes.trim() || undefined,
      });
      onDone();
      resetAndClose();
    } catch (err) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Could not initiate transfer.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={resetAndClose} title="Transfer Patient">
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTransferType("internal")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
              transferType === "internal"
                ? "border-doctor-accent bg-emerald-50 text-doctor-accent"
                : "border-slate-300 text-slate-600"
            }`}
          >
            Internal
          </button>
          <button
            type="button"
            onClick={() => setTransferType("external")}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
              transferType === "external"
                ? "border-doctor-accent bg-emerald-50 text-doctor-accent"
                : "border-slate-300 text-slate-600"
            }`}
          >
            External
          </button>
        </div>

        {transferType === "internal" ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Department</label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {departments.length === 0 && <option value="">Loading departments…</option>}
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Hospital name</label>
              <input
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Hospital contact</label>
              <input
                value={hospitalContact}
                onChange={(e) => setHospitalContact(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Urgency</label>
          <select
            value={urgency}
            onChange={(e) => setUrgency(e.target.value as TransferUrgency)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Reason (minimum 20 characters)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          {reasonTooShort && (
            <p className="mt-1 text-xs text-red-600">{20 - trimmedReasonLength} more characters needed.</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Handover notes</label>
          <textarea
            value={handoverNotes}
            onChange={(e) => setHandoverNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-doctor-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? "Submitting…" : "Initiate Transfer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
