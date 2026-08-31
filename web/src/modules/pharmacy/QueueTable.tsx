import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import type { QueueItem } from "./api";

interface QueueTableProps {
  items: QueueItem[];
  dispensingId: string | null;
  errors: Record<string, string>;
  onDispense: (item: QueueItem) => void;
}

function statusTone(status: QueueItem["status"]): "amber" | "red" | "green" {
  if (status === "out_of_stock") return "red";
  if (status === "dispensed") return "green";
  return "amber";
}

export function QueueTable({ items, dispensingId, errors, onDispense }: QueueTableProps) {
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
        <div>
          <button
            type="button"
            disabled={dispensingId === row.id}
            onClick={() => onDispense(row)}
            className="rounded-lg bg-pharmacy-accent px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {dispensingId === row.id ? "Dispensing…" : "Dispense"}
          </button>
          {errors[row.id] && <p className="mt-1 max-w-[220px] text-xs font-medium text-red-600">{errors[row.id]}</p>}
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} rows={items} keyFor={(row) => row.id} emptyMessage="Queue is empty" />;
}
