import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { DataTable, type Column } from "@/components/DataTable";
import { IconSearch, IconFile } from "@/components/icons";
import { StatusBadge } from "@/modules/lab/components/StatusBadge";
import { fetchPatientTests, type TestHistoryItem } from "@/modules/lab/api";

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
  ];

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
    </div>
  );
}
