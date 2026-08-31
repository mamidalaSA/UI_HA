import { Link } from "react-router-dom";
import { IconArrowRight, IconUser } from "@/components/icons";
import { useNurseAlerts } from "@/modules/nurse/hooks";
import { patientsFromAlerts } from "@/modules/nurse/api";

// NOTE: the spec's Head Nurse endpoints have no dedicated "list patients in my ward"
// route — only GET /api/nurse/alerts is ward-scoped. This page derives the patient
// list from the distinct patients that currently have an active dose alert. A patient
// with no pending alert right now (all doses already given) won't be listed here.
export default function PatientsPage() {
  const { alerts, loading, error } = useNurseAlerts();
  const patients = patientsFromAlerts(alerts);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Patients on your ward with an active dose alert right now. Open a patient to record vitals or view history.
      </p>

      {loading && <p className="text-sm text-slate-400">Loading…</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!loading && !error && patients.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-400">
          No patients with active alerts right now.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {patients.map((p) => (
          <Link
            key={p.patient_id}
            to={`/nurse/observation/${p.patient_id}`}
            state={{ patientName: p.patient_name }}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-nurse-accent hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-nurse-accent">
                <IconUser className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{p.patient_name}</p>
                <p className="text-xs text-slate-500">
                  {p.ward ?? "Ward —"} · {p.active_alert_count} active alert{p.active_alert_count === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <IconArrowRight className="h-4 w-4 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
