import { Link } from "react-router-dom";
import { IconArrowRight, IconUser } from "@/components/icons";
import { useNurseAlerts } from "@/modules/nurse/hooks";
import { patientsFromAlerts } from "@/modules/nurse/api";

// Landing page for the "Nurse Observation" nav item — pick a patient to open their
// observation record (vitals + medication log). Same derived-from-alerts patient list
// as PatientsPage; see the note there about the missing ward-patient-list endpoint.
export default function ObservationPickerPage() {
  const { alerts, loading, error } = useNurseAlerts();
  const patients = patientsFromAlerts(alerts);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Select a patient to record vitals or review their observation history.</p>

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
              <p className="text-sm font-semibold text-slate-800">{p.patient_name}</p>
            </div>
            <IconArrowRight className="h-4 w-4 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
