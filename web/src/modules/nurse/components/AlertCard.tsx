import { Badge } from "@/components/Badge";
import { IconPill } from "@/components/icons";
import type { NurseAlert } from "@/modules/nurse/api";
import { formatTime, STATUS_TONE } from "@/modules/nurse/format";

interface AlertCardProps {
  alert: NurseAlert;
  acking: boolean;
  onAcknowledge: () => void;
  onLogDose: () => void;
}

export function AlertCard({ alert, acking, onAcknowledge, onLogDose }: AlertCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-nurse-accent">
          <IconPill className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{alert.patient_name}</p>
          <p className="text-sm text-slate-600">
            {alert.medicine_name} · {alert.dosage} · {alert.route}
          </p>
          {alert.special_instructions && (
            <p className="mt-0.5 text-xs text-slate-400">{alert.special_instructions}</p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <Badge tone={STATUS_TONE[alert.status]}>{alert.status}</Badge>
            <span className="text-xs text-slate-500">Due {formatTime(alert.fire_at)}</span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 self-stretch sm:self-auto">
        <button
          onClick={onAcknowledge}
          disabled={acking || alert.status !== "FIRED"}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
        >
          {acking ? "…" : "Acknowledge"}
        </button>
        <button
          onClick={onLogDose}
          className="flex-1 rounded-lg bg-nurse-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 sm:flex-none"
        >
          Log dose
        </button>
      </div>
    </div>
  );
}
