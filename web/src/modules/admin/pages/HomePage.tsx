import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { IconBed, IconClipboard, IconFlask, IconHeart, IconUser } from "@/components/icons";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { useAuth } from "@/modules/auth/AuthContext";
import {
  getReportsSummary,
  listDepartments,
  listDoctorRoster,
  listDoctors,
  listLabQueue,
  listPatients,
  type Department,
  type Doctor,
  type DoctorRoster,
  type LabQueueItem,
  type Patient,
  type ReportsSummary,
} from "../api";
import { EmergencyBoard } from "../components/EmergencyBoard";
import { PendingInvestigations } from "../components/PendingInvestigations";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Roster stores 0=Monday..6=Sunday; JS Date#getDay() returns 0=Sunday..6=Saturday.
function todayRosterIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [roster, setRoster] = useState<DoctorRoster[]>([]);
  const [labQueue, setLabQueue] = useState<LabQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () =>
      Promise.all([
        getReportsSummary(),
        listPatients().catch(() => []),
        listDepartments().catch(() => []),
        listDoctors().catch(() => []),
        listDoctorRoster().catch(() => []),
        listLabQueue().catch(() => []),
      ]).then(([summaryRes, patientsRes, departmentsRes, doctorsRes, rosterRes, labQueueRes]) => {
        if (cancelled) return;
        setSummary(summaryRes);
        setPatients(patientsRes);
        setDepartments(departmentsRes);
        setDoctors(doctorsRes);
        setRoster(rosterRes);
        setLabQueue(labQueueRes);
        setLastUpdated(new Date());
        setLoading(false);
      });

    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) map.set(d.id, d.name);
    return map;
  }, [departments]);

  const today = todayKey();
  const admissionsToday = useMemo(
    () => patients.filter((p) => p.admitted_at?.slice(0, 10) === today),
    [patients, today]
  );
  const dischargesToday = useMemo(
    () => patients.filter((p) => p.discharged_at?.slice(0, 10) === today),
    [patients, today]
  );
  const activeInpatients = useMemo(
    () => patients.filter((p) => p.profile_status === "active" && p.admission_type === "inpatient").length,
    [patients]
  );

  const onDutyToday = useMemo(() => {
    const rosterIdx = todayRosterIndex();
    const onDutyDoctorIds = new Set(
      roster.filter((r) => r.day_of_week === rosterIdx && r.is_on_duty).map((r) => r.doctor_id)
    );
    return doctors.filter((d) => onDutyDoctorIds.has(d.id) && d.is_active);
  }, [doctors, roster]);

  const admissionColumns: Column<Patient>[] = [
    { header: "Patient", render: (p) => <span className="font-medium text-slate-800">{p.full_name}</span> },
    {
      header: "Department",
      render: (p) => (p.department_id ? departmentNameById.get(p.department_id) ?? "—" : "—"),
    },
    { header: "Type", render: (p) => <span className="capitalize">{p.admission_type}</span> },
    {
      header: "Time",
      render: (p) => (p.admitted_at ? new Date(p.admitted_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—"),
    },
  ];

  const dutyColumns: Column<Doctor>[] = [
    { header: "Doctor", render: (d) => <span className="font-medium text-slate-800">{d.full_name}</span> },
    { header: "Specialty", render: (d) => d.specialty },
    { header: "Status", render: () => <Badge tone="green">On duty</Badge> },
  ];

  const displayName = user?.full_name ?? "Doctor";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">
            {greeting()}, {displayName.startsWith("Dr.") ? displayName : `Dr. ${displayName}`}
          </h2>
          <p className="text-sm text-slate-500">
            {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" — "}here's what's happening across the hospital right now.
          </p>
        </div>
        <p className="text-xs text-slate-400">
          {lastUpdated ? (
            <>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
              Live — updated {lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </>
          ) : (
            "Loading…"
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          icon={<IconBed className="h-6 w-6 text-blue-600" />}
          iconBg="bg-blue-100"
          label="Active Inpatients"
          value={loading ? "…" : activeInpatients}
        />
        <StatCard
          icon={<IconUser className="h-6 w-6 text-emerald-600" />}
          iconBg="bg-emerald-100"
          label="Admitted Today"
          value={loading ? "…" : admissionsToday.length}
        />
        <StatCard
          icon={<IconClipboard className="h-6 w-6 text-slate-600" />}
          iconBg="bg-slate-200"
          label="Discharged Today"
          value={loading ? "…" : dischargesToday.length}
        />
        <StatCard
          icon={<IconHeart className="h-6 w-6 text-indigo-600" />}
          iconBg="bg-indigo-100"
          label="Doctors On Duty"
          value={loading ? "…" : onDutyToday.length}
        />
        <StatCard
          icon={<IconFlask className="h-6 w-6 text-amber-600" />}
          iconBg="bg-amber-100"
          label="Pending Investigations"
          value={loading ? "…" : labQueue.length}
        />
      </div>

      <Panel title="Emergency Cases">
        <EmergencyBoard patients={patients} departmentNameById={departmentNameById} />
      </Panel>

      <Panel title="Pending Investigations">
        <PendingInvestigations items={labQueue} />
      </Panel>

      <Panel title="Doctors On Duty Today">
        <DataTable
          columns={dutyColumns}
          rows={onDutyToday}
          keyFor={(d) => d.id}
          emptyMessage="No roster set for today"
        />
      </Panel>

      <Panel title="Admitted Today">
        <DataTable
          columns={admissionColumns}
          rows={admissionsToday}
          keyFor={(p) => p.id}
          emptyMessage="No admissions yet today"
        />
      </Panel>
    </div>
  );
}
