import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { IconBed } from "@/components/icons";
import { ReceptionShell } from "./ReceptionShell";

// NOTE: Bed / ward management is not part of the Module 1 spec's `patients` table or
// any Reception endpoint — there is no backend model or API for it. This page is a
// static, non-functional demo so the sidebar link has somewhere to go; all figures
// below are hardcoded illustrative data, not live data.
interface WardRow {
  ward: string;
  totalBeds: number;
  occupied: number;
  available: number;
  status: "Available" | "Nearly Full" | "Full";
}

const WARDS: WardRow[] = [
  { ward: "General Ward A", totalBeds: 30, occupied: 22, available: 8, status: "Available" },
  { ward: "General Ward B", totalBeds: 30, occupied: 27, available: 3, status: "Nearly Full" },
  { ward: "ICU", totalBeds: 12, occupied: 12, available: 0, status: "Full" },
  { ward: "Maternity", totalBeds: 16, occupied: 11, available: 5, status: "Available" },
  { ward: "Pediatrics", totalBeds: 18, occupied: 16, available: 2, status: "Nearly Full" },
];

const STATUS_TONE: Record<WardRow["status"], "green" | "amber" | "red"> = {
  Available: "green",
  "Nearly Full": "amber",
  Full: "red",
};

export default function BedAvailabilityPage() {
  const totalBeds = WARDS.reduce((sum, w) => sum + w.totalBeds, 0);
  const totalAvailable = WARDS.reduce((sum, w) => sum + w.available, 0);

  const columns: Column<WardRow>[] = [
    { header: "Ward", render: (w) => <span className="font-medium text-slate-800">{w.ward}</span> },
    { header: "Total Beds", render: (w) => w.totalBeds },
    { header: "Occupied", render: (w) => w.occupied },
    { header: "Available", render: (w) => w.available },
    { header: "Status", render: (w) => <Badge tone={STATUS_TONE[w.status]}>{w.status}</Badge> },
  ];

  return (
    <ReceptionShell pageTitle="Bed Availability">
      <div className="space-y-6">
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          Demo data — bed/ward tracking is not part of the current backend build.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard icon={<IconBed className="h-6 w-6 text-white" />} iconBg="bg-reception-accent" label="Total Beds" value={totalBeds} />
          <StatCard icon={<IconBed className="h-6 w-6 text-white" />} iconBg="bg-emerald-500" label="Available Beds" value={totalAvailable} />
        </div>
        <Panel title="Ward Overview">
          <DataTable columns={columns} rows={WARDS} keyFor={(w) => w.ward} />
        </Panel>
      </div>
    </ReceptionShell>
  );
}
