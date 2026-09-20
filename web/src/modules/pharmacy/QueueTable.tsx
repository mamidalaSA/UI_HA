import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import type { QueueItem } from "./api";

interface QueueTableProps {
  items: QueueItem[];
  onDispense: (item: QueueItem) => void;
  onViewHistory: (item: QueueItem) => void;
}

function statusTone(status: QueueItem["status"]): "amber" | "red" | "green" {
  if (status === "out_of_stock") return "red";
  if (status === "dispensed") return "green";
  return "amber";
}

export function QueueTable({ items, onDispense, onViewHistory }: QueueTableProps) {
  const columns: Column<QueueItem>[] = [
    {
      header: "Patient",
      render: (row) => (
        <div>
          <p className="font-semibold text-slate-800">{row.patient_name}</p>
          {row.ward && <p className="text-xs text-slate-400">Ward {row.ward}</p>}
        </div>
      ),
    },
    {
      header: "Admitted",
      render: (row) => (row.admitted_at ? new Date(row.admitted_at).toLocaleString() : "—"),
    },
    {
      header: "Medicines",
      render: (row) => (
        <ul className="space-y-0.5">
          {row.lines.map((line) => (
            <li key={line.id} className="text-xs text-slate-600">
              <span className="font-medium text-slate-700">{line.medicine_name}</span> · {line.dosage} ·{" "}
              {line.frequency.replace(/_/g, " ")}
            </li>
          ))}
        </ul>
      ),
    },
    {
      header: "Status",
      render: (row) => <Badge tone={statusTone(row.status)}>{row.status.replace(/_/g, " ")}</Badge>,
    },
    {
      header: "",
      render: (row) => (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onViewHistory(row)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            History
          </button>
          <button
            type="button"
            onClick={() => onDispense(row)}
            className="rounded-lg bg-pharmacy-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Dispense
          </button>
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} rows={items} keyFor={(row) => row.id} emptyMessage="Queue is empty" />;
}
