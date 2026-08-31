import { Link } from "react-router-dom";
import { DataTable, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/modules/lab/components/StatusBadge";
import type { TestQueueItem } from "@/modules/lab/api";

interface QueueTableProps {
  items: TestQueueItem[];
  busyId: string | null;
  onStart: (item: TestQueueItem) => void;
  onComplete: (item: TestQueueItem) => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function QueueTable({ items, busyId, onStart, onComplete }: QueueTableProps) {
  const columns: Column<TestQueueItem>[] = [
    { header: "Patient", render: (row) => <span className="font-medium text-slate-800">{row.patient_name}</span> },
    { header: "Test", render: (row) => row.test_name },
    { header: "Category", render: (row) => <span className="text-slate-500">{row.category}</span> },
    { header: "Ordered", render: (row) => formatDateTime(row.ordered_at) },
    { header: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      header: "Actions",
      render: (row) => (
        <div className="flex gap-2">
          {row.status === "pending" && (
            <button
              onClick={() => onStart(row)}
              disabled={busyId === row.id}
              className="rounded-lg bg-lab-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start
            </button>
          )}
          {row.status === "in_progress" && (
            <button
              onClick={() => onComplete(row)}
              disabled={busyId === row.id}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Complete
            </button>
          )}
          <Link
            to={`/lab/history?patient_id=${row.patient_id}&patient_name=${encodeURIComponent(row.patient_name)}`}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            History
          </Link>
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} rows={items} keyFor={(row) => row.id} emptyMessage="No tests in the queue" />;
}
