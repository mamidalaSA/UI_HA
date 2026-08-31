import { useCallback, useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Panel } from "@/components/Panel";
import { IconUser } from "@/components/icons";
import { EscalateModal } from "@/modules/nurse/components/EscalateModal";
import { VitalsForm } from "@/modules/nurse/components/VitalsForm";
import {
  createEscalation,
  fetchMedicationLog,
  fetchVitalsHistory,
  type MedicationLog,
  type Vitals,
} from "@/modules/nurse/api";
import { formatDateTime } from "@/modules/nurse/format";

export default function ObservationPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const location = useLocation();
  const patientName = (location.state as { patientName?: string } | null)?.patientName ?? "Patient";

  const [vitals, setVitals] = useState<Vitals[]>([]);
  const [medLog, setMedLog] = useState<MedicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [escalateSent, setEscalateSent] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const [vitalsData, medLogData] = await Promise.all([
        fetchVitalsHistory(patientId),
        fetchMedicationLog(patientId),
      ]);
      setVitals(vitalsData);
      setMedLog(medLogData);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleEscalate(message: string) {
    if (!patientId) return;
    setEscalating(true);
    try {
      await createEscalation(patientId, message);
      setEscalateSent(true);
      setEscalateOpen(false);
    } finally {
      setEscalating(false);
    }
  }

  const vitalsColumns: Column<Vitals>[] = [
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

  const medLogColumns: Column<MedicationLog>[] = [
    { header: "Time", render: (m) => formatDateTime(m.administered_at) },
    { header: "Dose given", render: (m) => m.dose_given ?? "—" },
    { header: "Route", render: (m) => m.route_used ?? "—" },
    {
      header: "Outcome",
      render: (m) => (m.skipped ? <Badge tone="red">Skipped</Badge> : <Badge tone="green">Given</Badge>),
    },
    { header: "Skip reason", render: (m) => m.skip_reason ?? "—" },
    { header: "Notes", render: (m) => m.notes ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-nurse-accent">
            <IconUser className="h-6 w-6" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-800">{patientName}</p>
            <p className="text-xs text-slate-500">Patient ID: {patientId}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {escalateSent && <span className="text-xs font-medium text-emerald-600">Escalation sent</span>}
          <button
            onClick={() => setEscalateOpen(true)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Escalate to doctor
          </button>
        </div>
      </div>

      <Panel title="Record vitals">
        {patientId && <VitalsForm patientId={patientId} onRecorded={loadHistory} />}
      </Panel>

      {/*
        IVF Monitoring and Intake & Output below are shown on the reference screenshot
        for visual fidelity, but the build spec's Head Nurse module has no database
        table or API endpoint for either (only `vitals` and `medication_log` exist).
        These panels are therefore static/demo-only placeholders — no fetch, no submit,
        no real data — and must not be wired up as if they were backed by the API.
      */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="IVF Monitoring" className="opacity-90">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Demo only — not wired to any API</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Fluid</p>
              <p className="font-semibold text-slate-700">Normal Saline 0.9%</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Rate</p>
              <p className="font-semibold text-slate-700">100 mL/hr</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Volume remaining</p>
              <p className="font-semibold text-slate-700">420 mL</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Line site</p>
              <p className="font-semibold text-slate-700">Left forearm</p>
            </div>
          </div>
        </Panel>

        <Panel title="Intake & Output" className="opacity-90">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">Demo only — not wired to any API</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Oral intake</p>
              <p className="font-semibold text-slate-700">600 mL</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">IV intake</p>
              <p className="font-semibold text-slate-700">480 mL</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Urine output</p>
              <p className="font-semibold text-slate-700">850 mL</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">Balance</p>
              <p className="font-semibold text-slate-700">+230 mL</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Vitals history">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <DataTable columns={vitalsColumns} rows={vitals} keyFor={(v) => v.id} emptyMessage="No vitals recorded yet." />
        )}
      </Panel>

      <Panel title="Medication log history">
        {loading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : (
          <DataTable columns={medLogColumns} rows={medLog} keyFor={(m) => m.id} emptyMessage="No doses logged yet." />
        )}
      </Panel>

      <EscalateModal
        open={escalateOpen}
        patientName={patientName}
        submitting={escalating}
        onClose={() => setEscalateOpen(false)}
        onSubmit={handleEscalate}
      />
    </div>
  );
}
