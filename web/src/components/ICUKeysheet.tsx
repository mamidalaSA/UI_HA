import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Panel } from "@/components/Panel";
import type { ICUKeysheetPatient, ICUVitalsReading } from "@/lib/icuKeysheet";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const vitalsColumns: Column<ICUVitalsReading>[] = [
  { header: "Recorded", render: (v) => formatDateTime(v.recorded_at) },
  { header: "Temp (°C)", render: (v) => v.temperature_c ?? "—" },
  { header: "BP", render: (v) => (v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—") },
  { header: "Pulse", render: (v) => v.pulse_bpm ?? "—" },
  { header: "SpO2 (%)", render: (v) => v.spo2_pct ?? "—" },
  { header: "Resp", render: (v) => v.resp_rate ?? "—" },
  { header: "Glucose", render: (v) => v.blood_glucose ?? "—" },
  { header: "GCS", render: (v) => v.gcs_score ?? "—" },
  {
    header: "Status",
    render: (v) => (v.flagged ? <Badge tone="red">Flagged</Badge> : <Badge tone="green">Normal</Badge>),
  },
];

interface ICUKeysheetProps {
  patients: ICUKeysheetPatient[];
  emptyMessage?: string;
}

/** The consolidated ICU Key Sheet — one panel per active ICU patient with their
 * full vitals history, in the same row/column shape a paper ICU keysheet uses.
 * Shared across nurse (own ward), doctor (own patients) and admin (everyone) —
 * same component, same data, scoped by the backend per caller's role. */
export function ICUKeysheet({ patients, emptyMessage = "No active ICU patients right now" }: ICUKeysheetProps) {
  if (patients.length === 0) {
    return (
      <Panel title="ICU Key Sheet">
        <p className="py-10 text-center text-sm text-slate-400">{emptyMessage}</p>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {patients.map((p) => (
        <Panel
          key={p.patient_id}
          title={p.full_name}
          action={
            <div className="text-right text-xs text-slate-400">
              <p>{p.doctor_name ? `Dr. ${p.doctor_name.replace(/^Dr\.\s*/, "")}` : "Unassigned"}</p>
              <p>{p.admitted_at ? `Admitted ${formatDateTime(p.admitted_at)}` : ""}</p>
            </div>
          }
        >
          <DataTable
            columns={vitalsColumns}
            rows={p.vitals}
            keyFor={(v) => v.id}
            emptyMessage="No vitals recorded yet"
          />
        </Panel>
      ))}
    </div>
  );
}
