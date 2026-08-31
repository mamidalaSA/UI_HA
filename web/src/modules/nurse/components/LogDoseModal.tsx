import { useState } from "react";
import { Modal } from "@/components/Modal";
import type { NurseAlert } from "@/modules/nurse/api";

interface LogDoseModalProps {
  alert: NurseAlert | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: { dose_given: string; skipped: boolean; skip_reason: string; notes: string }) => void;
}

export function LogDoseModal({ alert, submitting, onClose, onSubmit }: LogDoseModalProps) {
  const [skipped, setSkipped] = useState(false);
  const [doseGiven, setDoseGiven] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [notes, setNotes] = useState("");

  if (!alert) return null;

  function reset() {
    setSkipped(false);
    setDoseGiven("");
    setSkipReason("");
    setNotes("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit() {
    if (skipped && !skipReason.trim()) return; // spec: skip_reason required if skipped
    onSubmit({
      dose_given: doseGiven.trim(),
      skipped,
      skip_reason: skipReason.trim(),
      notes: notes.trim(),
    });
  }

  return (
    <Modal
      open={!!alert}
      onClose={handleClose}
      title={`Log dose — ${alert.medicine_name}`}
      footer={
        <>
          <button
            onClick={handleClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || (skipped && !skipReason.trim())}
            className="rounded-lg bg-nurse-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Patient: <span className="font-medium text-slate-700">{alert.patient_name}</span>
          <br />
          Prescribed: <span className="font-medium text-slate-700">{alert.dosage} · {alert.route}</span>
        </p>

        <div className="flex overflow-hidden rounded-lg border border-slate-300 text-sm font-medium">
          <button
            type="button"
            onClick={() => setSkipped(false)}
            className={`flex-1 px-3 py-2 ${!skipped ? "bg-nurse-accent text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            Given
          </button>
          <button
            type="button"
            onClick={() => setSkipped(true)}
            className={`flex-1 px-3 py-2 ${skipped ? "bg-red-500 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            Skipped
          </button>
        </div>

        {!skipped && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Dose given <span className="font-normal text-slate-400">(defaults to prescribed if left blank)</span>
            </label>
            <input
              type="text"
              value={doseGiven}
              onChange={(e) => setDoseGiven(e.target.value)}
              placeholder={alert.dosage}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-nurse-accent focus:outline-none focus:ring-1 focus:ring-nurse-accent"
            />
          </div>
        )}

        {skipped && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Skip reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={skipReason}
              onChange={(e) => setSkipReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-nurse-accent focus:outline-none focus:ring-1 focus:ring-nurse-accent"
              placeholder="Required — why was this dose skipped?"
            />
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-nurse-accent focus:outline-none focus:ring-1 focus:ring-nurse-accent"
            placeholder="Optional notes"
          />
        </div>
      </div>
    </Modal>
  );
}
