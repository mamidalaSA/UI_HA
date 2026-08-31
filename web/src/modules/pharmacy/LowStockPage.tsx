import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Panel } from "@/components/Panel";
import { fetchLowStock, type StockItem } from "./api";

type Severity = "critical" | "high" | "medium";

function severityOf(item: StockItem): Severity {
  if (item.quantity <= 0) return "critical";
  if (item.quantity <= item.min_threshold / 2) return "high";
  return "medium";
}

const SEVERITY_TONE: Record<Severity, "red" | "amber" | "blue"> = {
  critical: "red",
  high: "amber",
  medium: "blue",
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Out of stock",
  high: "Critically low",
  medium: "Below threshold",
};

export default function LowStockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setItems(await fetchLowStock());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const columns: Column<StockItem>[] = [
    { header: "Medicine", render: (row) => <span className="font-semibold text-slate-800">{row.medicine_name}</span> },
    { header: "Batch", render: (row) => row.batch_number },
    { header: "Quantity", render: (row) => row.quantity },
    { header: "Min threshold", render: (row) => row.min_threshold },
    {
      header: "Severity",
      render: (row) => <Badge tone={SEVERITY_TONE[severityOf(row)]}>{SEVERITY_LABEL[severityOf(row)]}</Badge>,
    },
  ];

  return (
    <Panel title="Low stock" action={<span className="text-xs text-slate-400">Below minimum threshold</span>}>
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
      ) : (
        <DataTable columns={columns} rows={items} keyFor={(row) => row.id} emptyMessage="Nothing is below threshold" />
      )}
    </Panel>
  );
}
