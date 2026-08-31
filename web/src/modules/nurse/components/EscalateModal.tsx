import { useState } from "react";
import { Modal } from "@/components/Modal";

interface EscalateModalProps {
  open: boolean;
  patientName: string;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (message: string) => void;
}

export function EscalateModal({ open, patientName, submitting, onClose, onSubmit }: EscalateModalProps) {
  const [message, setMessage] = useState("");

  function handleClose() {
    setMessage("");
    onClose();
  }

  function handleSubmit() {
    if (!message.trim()) return;
    onSubmit(message.trim());
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Escalate to doctor — ${patientName}`}
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
            disabled={submitting || !message.trim()}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Sending…" : "Send escalation"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Sends a push notification (and SMS) directly to this patient's assigned doctor.
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-nurse-accent focus:outline-none focus:ring-1 focus:ring-nurse-accent"
            placeholder="Describe the situation…"
          />
        </div>
      </div>
    </Modal>
  );
}
