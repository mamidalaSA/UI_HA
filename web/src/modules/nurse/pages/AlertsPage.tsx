import { useState } from "react";
import { AlertCard } from "@/modules/nurse/components/AlertCard";
import { LogDoseModal } from "@/modules/nurse/components/LogDoseModal";
import { useNurseAlerts } from "@/modules/nurse/hooks";
import type { NurseAlert } from "@/modules/nurse/api";

export default function AlertsPage() {
  const { alerts, loading, error, acknowledge, ackingId, submitLog, loggingId } = useNurseAlerts();
  const [logTarget, setLogTarget] = useState<NurseAlert | null>(null);

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
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Active dose alerts for your ward — 15 minutes before each dose is due, through 30 minutes after.
      </p>

      {loading && <p className="text-sm text-slate-400">Loading alerts…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && alerts.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          No active dose alerts right now.
        </div>
      )}

      <div className="space-y-3">
        {alerts.map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            acking={ackingId === alert.id}
            onAcknowledge={() => acknowledge(alert.id)}
            onLogDose={() => setLogTarget(alert)}
          />
        ))}
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
