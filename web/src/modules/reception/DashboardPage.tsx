import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { IconBed, IconCalendar, IconUsers } from "@/components/icons";
import { listPatients, type PatientListItem } from "./api";
import { ReceptionShell } from "./ReceptionShell";
import { PROFILE_STATUS_TONE, titleCase } from "./statusStyles";

// NOTE: "Today's Appointments" and "Available Beds" are illustrative static numbers.
// The build spec has no appointments/beds table for Module 1, so there is no backend
// endpoint to source these from — they are fixed placeholders, not live data.
const STATIC_APPOINTMENTS_TODAY = 24;
const STATIC_AVAILABLE_BEDS = 18;

function toTime(iso: string | null): number {
  return iso ? new Date(iso).getTime() : 0;
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function DashboardPage() {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPatients()
      .then((data) => {
        if (!cancelled) setPatients(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load patients.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const totalPatients = patients.length;
  const newToday = patients.filter((p) => isToday(p.created_at)).length;

  const recentRegistered = [...patients]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const recentDischarges = patients
    .filter((p) => p.profile_status === "discharged")
    .sort((a, b) => toTime(b.discharged_at) - toTime(a.discharged_at))
    .slice(0, 5);

  const columns: Column<PatientListItem>[] = [
    { header: "Name", render: (p) => <span className="font-medium text-slate-800">{p.full_name}</span> },
    { header: "Mobile", render: (p) => p.mobile },
    { header: "Channel", render: (p) => titleCase(p.intake_channel) },
    {
      header: "Status",
      render: (p) => <Badge tone={PROFILE_STATUS_TONE[p.profile_status]}>{titleCase(p.profile_status)}</Badge>,
    },
    {
      header: "Registered",
      render: (p) => new Date(p.created_at).toLocaleString(),
    },
  ];

  const dischargeColumns: Column<PatientListItem>[] = [
    { header: "Name", render: (p) => <span className="font-medium text-slate-800">{p.full_name}</span> },
    { header: "Mobile", render: (p) => p.mobile },
    { header: "Admission Type", render: (p) => titleCase(p.admission_type) },
    {
      header: "Discharged",
      render: (p) => (p.discharged_at ? new Date(p.discharged_at).toLocaleString() : "—"),
    },
  ];

  return (
    <ReceptionShell pageTitle="Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<IconUsers className="h-6 w-6 text-white" />}
            iconBg="bg-reception-accent"
            label="Total Patients"
            value={loading ? "…" : totalPatients}
            linkTo="/reception/patients"
          />
          <StatCard
            icon={<IconUsers className="h-6 w-6 text-white" />}
            iconBg="bg-emerald-500"
            label="New Patients Today"
            value={loading ? "…" : newToday}
            linkTo="/reception/patients"
          />
          <StatCard
            icon={<IconCalendar className="h-6 w-6 text-white" />}
            iconBg="bg-blue-500"
            label="Today's Appointments"
            value={STATIC_APPOINTMENTS_TODAY}
          />
          <StatCard
            icon={<IconBed className="h-6 w-6 text-white" />}
            iconBg="bg-amber-500"
            label="Available Beds"
            value={STATIC_AVAILABLE_BEDS}
            linkTo="/reception/beds"
          />
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}

        <Panel
          title="Recent Registered Patients"
          action={
            <Link to="/reception/patients" className="text-sm font-semibold text-reception-accent hover:underline">
              View all
            </Link>
          }
        >
          <DataTable columns={columns} rows={recentRegistered} keyFor={(p) => p.id} emptyMessage={loading ? "Loading…" : "No patients registered yet"} />
        </Panel>

        <Panel title="Recent Discharges">
          <DataTable
            columns={dischargeColumns}
            rows={recentDischarges}
            keyFor={(p) => p.id}
            emptyMessage={loading ? "Loading…" : "No discharges recorded yet"}
          />
        </Panel>
      </div>
    </ReceptionShell>
  );
}
