import { useEffect, useState } from "react";
import { ICUKeysheet } from "@/components/ICUKeysheet";
import { fetchIcuKeysheet, type ICUKeysheetPatient } from "@/lib/icuKeysheet";

export default function ICUKeysheetPage() {
  const [patients, setPatients] = useState<ICUKeysheetPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchIcuKeysheet()
      .then((data) => {
        if (!cancelled) setPatients(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? "Failed to load the ICU key sheet");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Every active patient in your ward's vitals history, digitally — record new readings from Nurse Observation.
      </p>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <ICUKeysheet patients={patients} emptyMessage="No active ICU patients in your ward right now" />
      )}
    </div>
  );
}
