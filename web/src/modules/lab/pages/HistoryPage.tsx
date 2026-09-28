import axios from "axios";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/Badge";
import { Panel } from "@/components/Panel";
import { Modal } from "@/components/Modal";
import { DataTable, type Column } from "@/components/DataTable";
import { IconSearch, IconFile } from "@/components/icons";
import { StatusBadge } from "@/modules/lab/components/StatusBadge";
import { collectTestPayment, fetchPatientTests, type LabPaymentStatus, type TestHistoryItem } from "@/modules/lab/api";

const PAYMENT_TONE: Record<LabPaymentStatus, "green" | "amber" | "blue"> = {
  paid: "green",
  pending: "amber",
  waived: "blue",
};

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function HistoryPage() {
  const [searchParams] = useSearchParams();
  const [patientId, setPatientId] = useState(searchParams.get("patient_id") ?? "");
  const [patientName, setPatientName] = useState(searchParams.get("patient_name") ?? "");
  const [items, setItems] = useState<TestHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [collectTarget, setCollectTarget] = useState<TestHistoryItem | null>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [collectBusy, setCollectBusy] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);

  async function runSearch(id: string) {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const data = await fetchPatientTests(id.trim());
      setItems(data);
    } catch {
      setError("Could not load test history for that patient. Check the patient ID and try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const idFromUrl = searchParams.get("patient_id");
    if (idFromUrl) {
      runSearch(idFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columns: Column<TestHistoryItem>[] = [
    { header: "Test", render: (row) => <span className="font-medium text-slate-800">{row.test_name}</span> },
    { header: "Category", render: (row) => <span className="text-slate-500">{row.category}</span> },
    { header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { header: "Ordered", render: (row) => formatDateTime(row.ordered_at) },
    { header: "Completed", render: (row) => formatDateTime(row.completed_at) },
    {
      header: "Result",
      render: (row) =>
        row.result_file_url ? (
          <a
            href={row.result_file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-lab-accent hover:underline"
          >
            <IconFile className="h-3.5 w-3.5" /> View file
          </a>
        ) : (
          <span className="text-slate-400">No file</span>
        ),
    },
    {
      header: "Billing",
      render: (row) => (
        <div>
          <Badge tone={PAYMENT_TONE[row.payment_status]}>
            ₹{row.amount.toFixed(2)} · {row.payment_status}
          </Badge>
          {row.payment_status === "pending" && (
            <button
              type="button"
              onClick={() => {
                setCollectTarget(row);
                setReceiptNumber("");
                setCollectError(null);
              }}
              className="ml-2 text-xs font-semibold text-lab-accent hover:underline"
            >
              Collect
            </button>
          )}
        </div>
      ),
    },
  ];

  async function handleCollectSubmit() {
    if (!collectTarget || !receiptNumber.trim()) return;
    setCollectBusy(true);
    setCollectError(null);
    try {
      await collectTestPayment(collectTarget.id, receiptNumber.trim());
      setCollectTarget(null);
      await runSearch(patientId);
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

  return (
    <div className="space-y-6">
      <Panel title="Search Patient History">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(patientId);
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="min-w-[280px] flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Patient ID</label>
            <input
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              placeholder="Paste patient UUID…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-lab-accent focus:outline-none focus:ring-1 focus:ring-lab-accent"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-lab-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <IconSearch className="h-4 w-4" /> Search
          </button>
        </form>
        {patientName && (
          <p className="mt-2 text-sm text-slate-500">
            Showing history for <span className="font-medium text-slate-700">{patientName}</span>
          </p>
        )}
      </Panel>

      <Panel title="Test History">
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading…</p>
        ) : !searched ? (
          <p className="py-8 text-center text-sm text-slate-400">Search for a patient to see their test history.</p>
        ) : (
          <DataTable columns={columns} rows={items} keyFor={(row) => row.id} emptyMessage="No test history for this patient" />
        )}
      </Panel>

      <Modal
        open={collectTarget !== null}
        onClose={() => setCollectTarget(null)}
        title={`Collect payment — ${collectTarget?.test_name ?? ""}`}
        footer={
          <>
            <button onClick={() => setCollectTarget(null)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={handleCollectSubmit}
              disabled={collectBusy || !receiptNumber.trim()}
              className="rounded-md bg-lab-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {collectBusy ? "Saving…" : "Collect"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Amount due: <span className="font-semibold text-slate-800">₹{collectTarget?.amount.toFixed(2)}</span>
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Receipt Number</label>
            <input
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lab-accent"
              placeholder="e.g. LAB-00231"
            />
          </div>
          {collectError && <p className="text-sm font-medium text-red-600">{collectError}</p>}
        </div>
      </Modal>
    </div>
  );
}
