import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/Badge";
import { IconBed, IconClipboard, IconHeart, IconUser, IconUsers } from "@/components/icons";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { DataTable, type Column } from "@/components/DataTable";
import {
  getReportsSummary,
  listDepartments,
  listPatients,
  type Department,
  type Patient,
  type ProfileStatus,
  type ReportsSummary,
} from "../api";
import { DonutChart } from "../components/DonutChart";

// Demo-only static row shape — there is no appointments/scheduling endpoint in
// the spec, so "Today's Appointments" is illustrative sample data, clearly
// marked as such rather than backed by a real query.
const DEMO_APPOINTMENTS = [
  { time: "09:00 AM", patient: "Rahul Mehta", doctor: "Dr. Anjali Rao", department: "Cardiology", status: "Confirmed" },
  { time: "10:30 AM", patient: "Sunita Verma", doctor: "Dr. Karan Shah", department: "Orthopedics", status: "Waiting" },
  { time: "11:15 AM", patient: "Arjun Nair", doctor: "Dr. Priya Iyer", department: "General Medicine", status: "Confirmed" },
  { time: "02:00 PM", patient: "Fatima Sheikh", doctor: "Dr. Anjali Rao", department: "Cardiology", status: "Waiting" },
];

const STATUS_TONE: Record<ProfileStatus, "green" | "blue" | "amber" | "red" | "slate"> = {
  draft: "slate",
  pending: "amber",
  active: "green",
  discharged: "blue",
  expired: "red",
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getReportsSummary(), listPatients().catch(() => []), listDepartments().catch(() => [])])
      .then(([summaryRes, patientsRes, departmentsRes]) => {
        if (cancelled) return;
        setSummary(summaryRes);
        setPatients(patientsRes);
        setDepartments(departmentsRes);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load dashboard data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) map.set(d.id, d.name);
    return map;
  }, [departments]);

  // "Patient Statistics" weekly view: there is no historical time-series
  // endpoint in the spec, so this is derived client-side from each patient's
  // created_at date, bucketed into the last 7 calendar days.
  const weeklySeries = useMemo(() => {
    const days: { key: string; label: string; registrations: number }[] = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(undefined, { weekday: "short" });
      days.push({ key, label, registrations: 0 });
    }
    const byKey = new Map(days.map((d): [string, (typeof days)[number]] => [d.key, d]));
    for (const p of patients) {
      const key = p.created_at?.slice(0, 10);
      const bucket = key ? byKey.get(key) : undefined;
      if (bucket) bucket.registrations += 1;
    }
    return days;
  }, [patients]);

  const recentAdmissions = useMemo(
    () =>
      [...patients]
        .filter((p) => p.admitted_at)
        .sort((a, b) => (b.admitted_at ?? "").localeCompare(a.admitted_at ?? ""))
        .slice(0, 6),
    [patients]
  );

  const departmentDonutData = useMemo(
    () =>
      (summary?.by_department ?? []).map((row) => ({
        label: row.department_name ?? (row.department_id ? departmentNameById.get(row.department_id) ?? "Unknown" : "Unassigned"),
        value: row.count,
      })),
    [summary, departmentNameById]
  );

  const genderDonutData = useMemo(
    () =>
      (summary?.by_gender ?? []).map((row) => ({
        label: row.gender,
        value: row.count,
      })),
    [summary]
  );

  const admissionColumns: Column<Patient>[] = [
    { header: "Patient", render: (p) => <span className="font-medium text-slate-800">{p.full_name}</span> },
    {
      header: "Department",
      render: (p) => (p.department_id ? departmentNameById.get(p.department_id) ?? "—" : "—"),
    },
    { header: "Type", render: (p) => <span className="capitalize">{p.admission_type}</span> },
    {
      header: "Status",
      render: (p) => <Badge tone={STATUS_TONE[p.profile_status]}>{p.profile_status}</Badge>,
    },
    {
      header: "Admitted",
      render: (p) => (p.admitted_at ? new Date(p.admitted_at).toLocaleString() : "—"),
    },
  ];

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={<IconUsers className="h-6 w-6 text-blue-600" />}
          iconBg="bg-blue-100"
          label="Total Patients"
          value={loading ? "…" : summary?.total_patients ?? 0}
        />
        <StatCard
          icon={<IconBed className="h-6 w-6 text-emerald-600" />}
          iconBg="bg-emerald-100"
          label="Admitted"
          value={loading ? "…" : summary?.admitted_patients ?? 0}
        />
        <StatCard
          icon={<IconClipboard className="h-6 w-6 text-slate-600" />}
          iconBg="bg-slate-200"
          label="Discharged"
          value={loading ? "…" : summary?.discharged_patients ?? 0}
        />
        <StatCard
          icon={<IconUser className="h-6 w-6 text-indigo-600" />}
          iconBg="bg-indigo-100"
          label="Doctors"
          value={loading ? "…" : summary?.total_doctors ?? 0}
        />
        <StatCard
          icon={<IconHeart className="h-6 w-6 text-sky-600" />}
          iconBg="bg-sky-100"
          label="Nurses"
          value={loading ? "…" : summary?.total_nurses ?? 0}
        />
        {/* Beds aren't part of any table in the spec's schema — this is a static
            demo placeholder, not backed by real data. */}
        <StatCard
          icon={<IconBed className="h-6 w-6 text-amber-600" />}
          iconBg="bg-amber-100"
          label="Available Beds"
          value="54 (demo)"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Panel title="Patient Statistics (last 7 days, by registration date)" className="xl:col-span-2">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklySeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#898781" }} axisLine={{ stroke: "#c3c2b7" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#898781" }} axisLine={false} tickLine={false} width={32} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="registrations"
                  name="New registrations"
                  stroke="#2a78d6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#2a78d6" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Patients by Gender">
          <DonutChart data={genderDonutData} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="Patients by Department">
          <DonutChart data={departmentDonutData} />
        </Panel>

        <Panel title="Today's Appointments">
          {/* No appointments/scheduling endpoint exists in the spec — demo data only. */}
          <DataTable
            columns={[
              { header: "Time", render: (r) => r.time },
              { header: "Patient", render: (r) => r.patient },
              { header: "Doctor", render: (r) => r.doctor },
              { header: "Department", render: (r) => r.department },
              {
                header: "Status",
                render: (r) => <Badge tone={r.status === "Confirmed" ? "green" : "amber"}>{r.status}</Badge>,
              },
            ]}
            rows={DEMO_APPOINTMENTS}
            keyFor={(r) => `${r.time}-${r.patient}`}
          />
        </Panel>
      </div>

      <Panel title="Recent Admissions">
        <DataTable columns={admissionColumns} rows={recentAdmissions} keyFor={(p) => p.id} emptyMessage="No admissions yet" />
      </Panel>
    </div>
  );
}
