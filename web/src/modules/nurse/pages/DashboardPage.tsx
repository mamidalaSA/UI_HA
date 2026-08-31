import { useState } from "react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { IconBell, IconClipboard, IconPill, IconUsers } from "@/components/icons";
import { AlertCard } from "@/modules/nurse/components/AlertCard";
import { LogDoseModal } from "@/modules/nurse/components/LogDoseModal";
import { useNurseAlerts } from "@/modules/nurse/hooks";
import { patientsFromAlerts, type NurseAlert } from "@/modules/nurse/api";

export default function DashboardPage() {
  const { alerts, loading, acknowledge, ackingId, submitLog, loggingId } = useNurseAlerts();
  const [logTarget, setLogTarget] = useState<NurseAlert | null>(null);

  const fired = alerts.filter((a) => a.status === "FIRED").length;
  const acknowledged = alerts.filter((a) => a.status === "ACKNOWLEDGED").length;
  const patients = patientsFromAlerts(alerts);

  async function handleLogSubmit(payload: { dose_given: string; skipped: boolean; skip_reason: string; notes: string }) {
    if (!logTarget) return;
    await submitLog(logTarget.id, {
      dose_given: payload.dose_given || null,
      skipped: payload.skipped,
      skip_reason: payload.skip_reason || null,
      notes: payload.notes || null,
    });
    setLogTarget(null);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<IconBell className="h-6 w-6 text-amber-600" />}
          iconBg="bg-amber-100"
          label="Awaiting acknowledgement"
          value={fired}
          linkTo="/nurse/alerts"
        />
        <StatCard
          icon={<IconPill className="h-6 w-6 text-sky-600" />}
          iconBg="bg-sky-100"
          label="Acknowledged, dose pending"
          value={acknowledged}
          linkTo="/nurse/alerts"
        />
        <StatCard
          icon={<IconUsers className="h-6 w-6 text-emerald-600" />}
          iconBg="bg-emerald-100"
          label="Patients with active alerts"
          value={patients.length}
          linkTo="/nurse/patients"
        />
        <StatCard
          icon={<IconClipboard className="h-6 w-6 text-purple-600" />}
          iconBg="bg-purple-100"
          label="Total active alerts"
          value={alerts.length}
          linkTo="/nurse/schedule"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-800">Dose alerts needing attention</h3>
          <Link to="/nurse/alerts" className="text-xs font-semibold text-nurse-accent hover:underline">
            View all
          </Link>
        </div>

        {loading && <p className="text-sm text-slate-400">Loading…</p>}
        {!loading && alerts.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">Nothing due right now.</p>
        )}

        <div className="space-y-3">
          {alerts.slice(0, 5).map((alert) => (
            <AlertCard
              key={alert.id}
              alert={alert}
              acking={ackingId === alert.id}
              onAcknowledge={() => acknowledge(alert.id)}
              onLogDose={() => setLogTarget(alert)}
            />
          ))}
        </div>
      </div>

      <LogDoseModal
        alert={logTarget}
        submitting={logTarget !== null && loggingId === logTarget.id}
        onClose={() => setLogTarget(null)}
        onSubmit={handleLogSubmit}
      />
    </div>
  );
}
