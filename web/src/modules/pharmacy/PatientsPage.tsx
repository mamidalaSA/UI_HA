import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { IconSearch } from "@/components/icons";
import { collectBill, fetchPatientsWithHistory, type PatientBillingSummary } from "./api";
import { CollectPaymentFields } from "./CollectPaymentFields";
import { PatientHistoryModal } from "./PatientHistoryModal";

export default function PatientsPage() {
  const [patients, setPatients] = useState<PatientBillingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [historyTarget, setHistoryTarget] = useState<PatientBillingSummary | null>(null);

  const [collectTarget, setCollectTarget] = useState<PatientBillingSummary | null>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [collectBusy, setCollectBusy] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      setPatients(await fetchPatientsWithHistory(q || undefined));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    void load(search);
  }

  function openCollect(p: PatientBillingSummary) {
    setCollectTarget(p);
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
      await load(search);
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

  const columns: Column<PatientBillingSummary>[] = [
    { header: "Patient", render: (p) => <span className="font-medium text-slate-800">{p.patient_name}</span> },
    { header: "Medicines Dispensed", render: (p) => p.total_entries },
    { header: "Last Dispensed", render: (p) => new Date(p.last_dispensed_at).toLocaleString() },
    {
      header: "Balance",
      render: (p) =>
        p.pending_amount > 0 ? (
          <Badge tone="amber">₹{p.pending_amount.toFixed(2)} due</Badge>
        ) : (
          <Badge tone="green">Settled</Badge>
        ),
    },
    {
      header: "Actions",
      render: (p) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setHistoryTarget(p)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            View history
          </button>
          {p.pending_amount > 0 && (
            <button
              type="button"
              onClick={() => openCollect(p)}
              className="rounded-lg bg-pharmacy-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Collect payment
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <form onSubmit={onSearchSubmit} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 sm:w-80">
        <IconSearch className="h-4 w-4 text-slate-400" />
        <input
          placeholder="Search by patient name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm outline-none"
        />
      </form>

      <Panel title={`Patients (${patients.length})`}>
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
        ) : (
          <DataTable
            columns={columns}
            rows={patients}
            keyFor={(p) => p.patient_id}
            emptyMessage="No patients have had medicines dispensed yet"
          />
        )}
      </Panel>

      <PatientHistoryModal
        patientId={historyTarget?.patient_id ?? null}
        patientName={historyTarget?.patient_name}
        onClose={() => setHistoryTarget(null)}
      />

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
            Amount due: <span className="font-semibold text-slate-800">₹{collectTarget?.pending_amount.toFixed(2)}</span>
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
    </div>
  );
}
