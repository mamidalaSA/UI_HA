import { useState, type FormEvent } from "react";
import { recordVitals, type Vitals, type VitalsCreatePayload } from "@/modules/nurse/api";

interface VitalsFormProps {
  patientId: string;
  onRecorded: (vitals: Vitals) => void;
}

type FieldKey = keyof VitalsCreatePayload;

const FIELDS: { key: FieldKey; label: string; unit: string; step: string }[] = [
  { key: "temperature_c", label: "Temperature", unit: "°C", step: "0.1" },
  { key: "bp_systolic", label: "BP Systolic", unit: "mmHg", step: "1" },
  { key: "bp_diastolic", label: "BP Diastolic", unit: "mmHg", step: "1" },
  { key: "pulse_bpm", label: "Pulse", unit: "bpm", step: "1" },
  { key: "spo2_pct", label: "SpO2", unit: "%", step: "1" },
  { key: "resp_rate", label: "Resp. rate", unit: "/min", step: "1" },
  { key: "blood_glucose", label: "Blood glucose", unit: "mg/dL", step: "0.1" },
  { key: "gcs_score", label: "GCS score", unit: "", step: "1" },
];

export function VitalsForm({ patientId, onRecorded }: VitalsFormProps) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    temperature_c: "",
    bp_systolic: "",
    bp_diastolic: "",
    pulse_bpm: "",
    spo2_pct: "",
    resp_rate: "",
    blood_glucose: "",
    gcs_score: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Vitals | null>(null);

  function setField(key: FieldKey, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: VitalsCreatePayload = {};
    for (const field of FIELDS) {
      const raw = values[field.key];
      payload[field.key] = raw.trim() === "" ? null : Number(raw);
    }
    const hasAnyValue = Object.values(payload).some((v) => v !== null);
    if (!hasAnyValue) {
      setError("Enter at least one vital reading.");
      return;
    }

    setSubmitting(true);
    try {
      const vitals = await recordVitals(patientId, payload);
      setResult(vitals);
      onRecorded(vitals);
      setValues({
        temperature_c: "",
        bp_systolic: "",
        bp_diastolic: "",
        pulse_bpm: "",
        spo2_pct: "",
        resp_rate: "",
        blood_glucose: "",
        gcs_score: "",
      });
    } catch {
      setError("Could not save vitals. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FIELDS.map((field) => (
          <div key={field.key}>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {field.label} {field.unit && <span className="text-slate-400">({field.unit})</span>}
            </label>
            <input
              type="number"
              step={field.step}
              value={values[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-nurse-accent focus:outline-none focus:ring-1 focus:ring-nurse-accent"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {result && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            result.flagged
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {result.flagged ? (
            <>
              <span className="font-semibold">Flagged — </span>
              {result.flag_reason}. The assigned doctor has been notified.
            </>
          ) : (
            "All recorded readings are within normal range."
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-nurse-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Record vitals"}
      </button>
    </form>
  );
}
