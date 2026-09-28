import { useMemo } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import type { LabQueueItem } from "../api";

interface PendingInvestigationsProps {
  items: LabQueueItem[];
}

/** What's still awaited across every patient in the hospital, oldest order
 * first — the clinical equivalent of an inbox: tests ordered but not yet
 * back, regardless of which doctor ordered them. */
export function PendingInvestigations({ items }: PendingInvestigationsProps) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(a.ordered_at).getTime() - new Date(b.ordered_at).getTime()),
    [items]
  );

  const columns: Column<LabQueueItem>[] = [
    { header: "Patient", render: (i) => <span className="font-medium text-slate-800">{i.patient_name}</span> },
    { header: "Test", render: (i) => i.test_name },
    {
      header: "Status",
      render: (i) => <Badge tone={i.status === "in_progress" ? "blue" : "amber"}>{i.status === "in_progress" ? "In progress" : "Pending"}</Badge>,
    },
    { header: "Ordered", render: (i) => new Date(i.ordered_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) },
  ];

  return (
    <div>
      <DataTable columns={columns} rows={sorted} keyFor={(i) => i.id} emptyMessage="No pending lab investigations" />
      <p className="mt-2 text-xs text-slate-400">Every test ordered hospital-wide that the lab hasn't completed yet.</p>
    </div>
  );
}
