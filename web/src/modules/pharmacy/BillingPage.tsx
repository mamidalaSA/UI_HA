import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { IconChart } from "@/components/icons";
import { collectBill, fetchPendingBills, type PendingBill } from "./api";
import { CollectPaymentFields } from "./CollectPaymentFields";
import { PatientHistoryModal } from "./PatientHistoryModal";

export default function BillingPage() {
  const [bills, setBills] = useState<PendingBill[]>([]);
  const [loading, setLoading] = useState(true);

  const [collectTarget, setCollectTarget] = useState<PendingBill | null>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [collectBusy, setCollectBusy] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);

  const [historyTarget, setHistoryTarget] = useState<PendingBill | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBills(await fetchPendingBills());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCollect(bill: PendingBill) {
    setCollectTarget(bill);
    setReceiptNumber("");
    setCollectError(null);
  }

  async function handleCollectSubmit() {
    if (!collectTarget || !receiptNumber.trim()) return;
    setCollectBusy(true);
    setCollectError(null);
    try {
      await collectBill(collectTarget.patient_id, receiptNumber.trim());
      setCollectTarget(null);
      await load();
    } catch (err) {
      let text = "Could not collect payment. Please try again.";
      if (axios.isAxiosError<{ detail?: string }>(err) && typeof err.response?.data?.detail === "string") {
        text = err.response.data.detail;
      }
      setCollectError(text);
    } finally {
      setCollectBusy(false);
    }
  }

  const totalPending = bills.reduce((sum, b) => sum + b.pending_amount, 0);

  const columns: Column<PendingBill>[] = [
    { header: "Patient", render: (b) => <span className="font-medium text-slate-800">{b.patient_name}</span> },
    { header: "Items", render: (b) => b.pending_entries },
    { header: "Amount Due", render: (b) => `₹${b.pending_amount.toFixed(2)}` },
    { header: "Last Dispensed", render: (b) => new Date(b.last_dispensed_at).toLocaleString() },
    {
      header: "Actions",
      render: (b) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setHistoryTarget(b)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            View history
          </button>
          <button
            type="button"
            onClick={() => openCollect(b)}
            className="rounded-lg bg-pharmacy-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            Collect payment
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={<IconChart className="h-6 w-6 text-white" />} iconBg="bg-pharmacy-accent" label="Patients with Dues" value={bills.length} />
        <StatCard icon={<IconChart className="h-6 w-6 text-white" />} iconBg="bg-red-500" label="Total Outstanding" value={`₹${totalPending.toFixed(2)}`} />
      </div>

      <Panel
        title="Pending pharmacy bills"
        action={
          <button type="button" onClick={() => void load()} className="text-xs font-semibold text-pharmacy-accent hover:underline">
            Refresh
          </button>
        }
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
        ) : (
          <DataTable columns={columns} rows={bills} keyFor={(b) => b.patient_id} emptyMessage="No pending pharmacy bills" />
        )}
      </Panel>

      <Modal
        open={collectTarget !== null}
        onClose={() => setCollectTarget(null)}
        title={`Collect payment — ${collectTarget?.patient_name ?? ""}`}
        footer={
          <>
            <button onClick={() => setCollectTarget(null)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={handleCollectSubmit}
              disabled={collectBusy || !receiptNumber.trim()}
              className="rounded-md bg-pharmacy-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {collectBusy ? "Saving…" : "Collect"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Amount due: <span className="font-semibold text-slate-800">₹{collectTarget?.pending_amount.toFixed(2)}</span> across{" "}
            {collectTarget?.pending_entries} item(s).
          </p>
          <CollectPaymentFields
            amount={collectTarget?.pending_amount ?? 0}
            note={`Pharmacy bill — ${collectTarget?.patient_name ?? ""}`}
            receiptNumber={receiptNumber}
            onReceiptChange={setReceiptNumber}
          />
          {collectError && <p className="text-sm font-medium text-red-600">{collectError}</p>}
        </div>
      </Modal>

      <PatientHistoryModal
        patientId={historyTarget?.patient_id ?? null}
        patientName={historyTarget?.patient_name}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
