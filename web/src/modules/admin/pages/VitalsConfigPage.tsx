import { useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/DataTable";
import { Panel } from "@/components/Panel";
import { listVitalsConfig, upsertVitalsConfig, type VitalsConfigEntry } from "../api";

// Seed vital names per the spec's table comment — the table itself only stores
// whatever rows exist, but these are the ones the rest of the system expects.
const KNOWN_VITALS = ["temperature_c", "bp_systolic", "bp_diastolic", "pulse_bpm", "spo2_pct", "resp_rate", "blood_glucose"];

const VITAL_LABELS: Record<string, string> = {
  temperature_c: "Temperature (°C)",
  bp_systolic: "BP Systolic (mmHg)",
  bp_diastolic: "BP Diastolic (mmHg)",
  pulse_bpm: "Pulse (bpm)",
  spo2_pct: "SpO2 (%)",
  resp_rate: "Respiratory Rate (/min)",
  blood_glucose: "Blood Glucose (mg/dL)",
};

interface Row {
  vital_name: string;
  min_value: string;
  max_value: string;
  saving: boolean;
}

export default function VitalsConfigPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    listVitalsConfig()
      .then((configured: VitalsConfigEntry[]) => {
        const byName = new Map(configured.map((c): [string, VitalsConfigEntry] => [c.vital_name, c]));
        const names = Array.from(new Set([...KNOWN_VITALS, ...configured.map((c) => c.vital_name)]));
        setRows(
          names.map((name) => {
            const existing = byName.get(name);
            return {
              vital_name: name,
              min_value: existing ? String(existing.min_value) : "",
              max_value: existing ? String(existing.max_value) : "",
              saving: false,
            };
          })
        );
      })
      .catch((err) => setError(err?.response?.data?.detail ?? "Failed to load vitals config"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function updateRow(name: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.vital_name === name ? { ...r, ...patch } : r)));
  }

  async function saveRow(row: Row) {
    const min = Number(row.min_value);
    const max = Number(row.max_value);
    if (Number.isNaN(min) || Number.isNaN(max)) return;
    updateRow(row.vital_name, { saving: true });
    try {
      await upsertVitalsConfig(row.vital_name, { min_value: min, max_value: max });
    } finally {
      updateRow(row.vital_name, { saving: false });
    }
  }

  const columns: Column<Row>[] = [
    { header: "Vital", render: (r) => <span className="font-medium text-slate-800">{VITAL_LABELS[r.vital_name] ?? r.vital_name}</span> },
    {
      header: "Min Value",
      render: (r) => (
        <input
          type="number"
          step="0.1"
          value={r.min_value}
          onChange={(e) => updateRow(r.vital_name, { min_value: e.target.value })}
          className="w-28 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-admin-accent"
        />
      ),
    },
    {
      header: "Max Value",
      render: (r) => (
        <input
          type="number"
          step="0.1"
          value={r.max_value}
          onChange={(e) => updateRow(r.vital_name, { max_value: e.target.value })}
          className="w-28 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-admin-accent"
        />
      ),
    },
    {
      header: "",
      render: (r) => (
        <button
          onClick={() => saveRow(r)}
          disabled={r.saving}
          className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
        >
          {r.saving ? "Saving..." : "Save"}
        </button>
      ),
    },
  ];

  return (
    <Panel title="Vitals Normal Ranges">
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <DataTable columns={columns} rows={rows} keyFor={(r) => r.vital_name} emptyMessage={loading ? "Loading..." : "No vitals configured"} />
    </Panel>
  );
}
