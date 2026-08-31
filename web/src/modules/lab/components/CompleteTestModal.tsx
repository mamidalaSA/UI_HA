import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";
import type { TestQueueItem } from "@/modules/lab/api";

interface CompleteTestModalProps {
  item: TestQueueItem | null;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (resultText: string, file: File | null) => void;
}

export function CompleteTestModal({ item, submitting, onClose, onSubmit }: CompleteTestModalProps) {
  const [resultText, setResultText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Clear the form whenever the target item changes — covers both closing (item -> null)
  // and a fresh open for a different test (item A -> item B) after a successful submit.
  useEffect(() => {
    setResultText("");
    setFile(null);
  }, [item?.id]);

  if (!item) return null;

  function handleClose() {
    onClose();
  }

  function handleSubmit() {
    if (!resultText.trim()) return;
    onSubmit(resultText.trim(), file);
  }

  return (
    <Modal
      open={!!item}
      onClose={handleClose}
      title={`Complete test — ${item.test_name}`}
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
            disabled={submitting || !resultText.trim()}
            className="rounded-lg bg-lab-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit result"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Patient: <span className="font-medium text-slate-700">{item.patient_name}</span>
        </p>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Result text</label>
          <textarea
            value={resultText}
            onChange={(e) => setResultText(e.target.value)}
            rows={5}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-lab-accent focus:outline-none focus:ring-1 focus:ring-lab-accent"
            placeholder="Enter test result findings…"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Result file <span className="font-normal text-slate-400">(PDF or DICOM, optional)</span>
          </label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
        </div>
      </div>
    </Modal>
  );
}
