import { StatCard } from "@/components/StatCard";
import { IconBell, IconClipboard, IconPill, IconUsers } from "@/components/icons";
import { useNurseAlerts } from "@/modules/nurse/hooks";
import { patientsFromAlerts } from "@/modules/nurse/api";

// The spec's Head Nurse endpoint list has no dedicated reporting/analytics endpoint —
// only the live GET /api/nurse/alerts feed is available. This page is therefore a
// lightweight, client-derived snapshot of that same feed (not a real reports backend),
// included for the "Reports" nav item's visual completeness.
export default function ReportsPage() {
  const { alerts, loading } = useNurseAlerts();
  const patients = patientsFromAlerts(alerts);
  const fired = alerts.filter((a) => a.status === "FIRED").length;
  const acknowledged = alerts.filter((a) => a.status === "ACKNOWLEDGED").length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Snapshot of your ward's current dose-alert queue. Full historical reporting is not part of the
        Head Nurse API surface in this build.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<IconBell className="h-6 w-6 text-amber-600" />}
          iconBg="bg-amber-100"
          label="Fired, unacknowledged"
          value={loading ? "…" : fired}
        />
        <StatCard
          icon={<IconPill className="h-6 w-6 text-sky-600" />}
          iconBg="bg-sky-100"
          label="Acknowledged, dose pending"
          value={loading ? "…" : acknowledged}
        />
        <StatCard
          icon={<IconUsers className="h-6 w-6 text-emerald-600" />}
          iconBg="bg-emerald-100"
          label="Patients with active alerts"
          value={loading ? "…" : patients.length}
        />
        <StatCard
          icon={<IconClipboard className="h-6 w-6 text-purple-600" />}
          iconBg="bg-purple-100"
          label="Total active alerts"
          value={loading ? "…" : alerts.length}
        />
      </div>
    </div>
  );
}
