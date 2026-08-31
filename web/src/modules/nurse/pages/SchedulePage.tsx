import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { useNurseAlerts } from "@/modules/nurse/hooks";
import type { NurseAlert } from "@/modules/nurse/api";
import { formatTime, STATUS_TONE } from "@/modules/nurse/format";

// Read-only view of the same GET /api/nurse/alerts feed as Dashboard/Alerts, laid out
// as a schedule table sorted by dose time. Dose actions (acknowledge / log) live on
// the Alerts page — this page is for at-a-glance planning of the ward's dose round.
export default function SchedulePage() {
  const { alerts, loading, error } = useNurseAlerts();

  const sorted = [...alerts].sort((a, b) => a.fire_at.localeCompare(b.fire_at));

  const columns: Column<NurseAlert>[] = [
    { header: "Time due", render: (a) => formatTime(a.fire_at) },
    { header: "Patient", render: (a) => a.patient_name },
    { header: "Medicine", render: (a) => a.medicine_name },
    { header: "Dosage", render: (a) => a.dosage },
    { header: "Route", render: (a) => a.route },
    { header: "Instructions", render: (a) => a.special_instructions ?? "—" },
    { header: "Status", render: (a) => <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge> },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Today's dose schedule for all admitted patients on your ward.</p>
      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <DataTable columns={columns} rows={sorted} keyFor={(a) => a.id} emptyMessage="No doses scheduled." />
      </div>
    </div>
  );
}
