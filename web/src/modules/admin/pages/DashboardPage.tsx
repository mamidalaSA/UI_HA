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
import {
  IconBed,
  IconChart,
  IconClipboard,
  IconHeart,
  IconTrendUp,
  IconUser,
  IconUsers,
  IconWallet,
} from "@/components/icons";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { DataTable, type Column } from "@/components/DataTable";
import {
  getReportsSummary,
  listDepartments,
  listDoctorStats,
  listPatients,
  listSalaries,
  type Department,
  type DoctorStats,
  type Patient,
  type ProfileStatus,
  type ReportsSummary,
  type StaffSalaryRow,
} from "../api";
import { DonutChart } from "../components/DonutChart";
import { DoctorLeaderboard } from "../components/DoctorLeaderboard";
import { EmergencyBoard } from "../components/EmergencyBoard";

function money(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// Total ward capacity isn't in the schema (no beds/wards table), so this is a fixed
// hospital-configuration constant — but "occupied" below is real, live data
// (admitted_patients from reports/summary), not a hardcoded figure.
const TOTAL_BED_CAPACITY = 80;

const STATUS_TONE: Record<ProfileStatus, "green" | "blue" | "amber" | "red" | "slate"> = {
  draft: "slate",
  pending: "amber",
  active: "green",
  discharged: "blue",
  expired: "red",
};

const CURRENT_PERIOD = new Date().toISOString().slice(0, 7);

export default function DashboardPage() {
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctorStats, setDoctorStats] = useState<DoctorStats[]>([]);
  const [salaries, setSalaries] = useState<StaffSalaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () =>
      Promise.all([
        getReportsSummary(),
        listPatients().catch(() => []),
        listDepartments().catch(() => []),
        listDoctorStats().catch(() => []),
        listSalaries(CURRENT_PERIOD).catch(() => []),
      ])
        .then(([summaryRes, patientsRes, departmentsRes, doctorStatsRes, salariesRes]) => {
          if (cancelled) return;
          setSummary(summaryRes);
          setPatients(patientsRes);
          setDepartments(departmentsRes);
          setDoctorStats(doctorStatsRes);
          setSalaries(salariesRes);
          setLastUpdated(new Date());
        })
        .catch((err) => {
          if (!cancelled) setError(err?.message ?? "Failed to load dashboard data");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

    load();
    // Light auto-refresh so the numbers keep moving during a live walkthrough.
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

  const totalCollected =
    (summary?.consult_billing.paid_amount ?? 0) + (summary?.pharmacy_billing.paid_amount ?? 0);
  const outstandingDues =
    (summary?.consult_billing.pending_amount ?? 0) +
    (summary?.pharmacy_billing.pending_amount ?? 0) +
    (summary?.labs_daily.dues ?? 0);
  const payrollPaid = salaries
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const payrollPending = salaries
    .filter((s) => s.status !== "paid")
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const availableBeds = Math.max(0, TOTAL_BED_CAPACITY - (summary?.admitted_patients ?? 0));

  const departmentDonutData = useMemo(
    () =>
      (summary?.by_department ?? []).map((row) => ({
        label: row.department_name ?? (row.department_id ? departmentNameById.get(row.department_id) ?? "Unknown" : "Unassigned"),
        value: row.count,
      })),
    [summary, departmentNameById]
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Command Center</h2>
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          icon={<IconUsers className="h-6 w-6 text-blue-600" />}
          iconBg="bg-blue-100"
          label="Patients"
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
        <StatCard
          icon={<IconBed className="h-6 w-6 text-amber-600" />}
          iconBg="bg-amber-100"
          label="Available Beds"
          value={loading ? "…" : availableBeds}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<IconTrendUp className="h-6 w-6 text-blue-600" />}
          iconBg="bg-blue-100"
          label="Total Collected (All-Time)"
          value={loading ? "…" : money(totalCollected)}
        />
        <StatCard
          icon={<IconChart className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          label="Outstanding Dues"
          value={loading ? "…" : money(outstandingDues)}
        />
        <StatCard
          icon={<IconWallet className="h-6 w-6 text-emerald-600" />}
          iconBg="bg-emerald-100"
          label="Payroll Paid (This Month)"
          value={loading ? "…" : money(payrollPaid)}
        />
        <StatCard
          icon={<IconWallet className="h-6 w-6 text-amber-600" />}
          iconBg="bg-amber-100"
          label="Payroll Pending (This Month)"
          value={loading ? "…" : money(payrollPending)}
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

        <Panel title="Pharmacy & Labs — Today">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500">Pharmacy Collected Today</p>
              <p className="text-lg font-bold text-emerald-700">
                {loading ? "…" : `₹${(summary?.pharmacy_daily.collected_today ?? 0).toFixed(2)}`}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500">Pharmacy Dues</p>
              <p className="text-lg font-bold text-amber-600">
                {loading ? "…" : `₹${(summary?.pharmacy_daily.dues ?? 0).toFixed(2)}`}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500">Labs Collected Today</p>
              <p className="text-lg font-bold text-emerald-700">
                {loading ? "…" : `₹${(summary?.labs_daily.collected_today ?? 0).toFixed(2)}`}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-medium text-slate-500">Labs Dues</p>
              <p className="text-lg font-bold text-amber-600">
                {loading ? "…" : `₹${(summary?.labs_daily.dues ?? 0).toFixed(2)}`}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">"Dues" is total currently outstanding, not limited to today.</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Panel title="Patients by Department">
          <DonutChart data={departmentDonutData} />
        </Panel>

        <Panel title="Emergency Cases">
          <EmergencyBoard patients={patients} departmentNameById={departmentNameById} />
        </Panel>
      </div>

      <Panel title="Doctor Performance Leaderboard">
        <DoctorLeaderboard doctors={doctorStats} />
      </Panel>

      <Panel title="Recent Admissions">
        <DataTable columns={admissionColumns} rows={recentAdmissions} keyFor={(p) => p.id} emptyMessage="No admissions yet" />
      </Panel>

      <Panel title="Billing">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            icon={<IconChart className="h-6 w-6 text-emerald-600" />}
            iconBg="bg-emerald-100"
            label="Bills Paid"
            value={
              loading
                ? "…"
                : `${(summary?.consult_billing.paid_count ?? 0) + (summary?.pharmacy_billing.paid_count ?? 0)} — ₹${(
                    (summary?.consult_billing.paid_amount ?? 0) + (summary?.pharmacy_billing.paid_amount ?? 0)
                  ).toFixed(2)}`
            }
          />
          <StatCard
            icon={<IconChart className="h-6 w-6 text-amber-600" />}
            iconBg="bg-amber-100"
            label="Bills Pending"
            value={
              loading
                ? "…"
                : `${(summary?.consult_billing.pending_count ?? 0) + (summary?.pharmacy_billing.pending_count ?? 0)} — ₹${(
                    (summary?.consult_billing.pending_amount ?? 0) + (summary?.pharmacy_billing.pending_amount ?? 0)
                  ).toFixed(2)}`
            }
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2.5">Stream</th>
                <th className="px-3 py-2.5">Paid</th>
                <th className="px-3 py-2.5">Pending</th>
                <th className="px-3 py-2.5">Waived</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  { label: "Consult fees (reception)", data: summary?.consult_billing },
                  { label: "Pharmacy", data: summary?.pharmacy_billing },
                ] as const
              ).map((row) => (
                <tr key={row.label} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-3 font-medium text-slate-700">{row.label}</td>
                  <td className="px-3 py-3">
                    <Badge tone="green">{row.data?.paid_count ?? 0}</Badge>{" "}
                    <span className="text-slate-500">₹{(row.data?.paid_amount ?? 0).toFixed(2)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone="amber">{row.data?.pending_count ?? 0}</Badge>{" "}
                    <span className="text-slate-500">₹{(row.data?.pending_amount ?? 0).toFixed(2)}</span>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone="blue">{row.data?.waived_count ?? 0}</Badge>{" "}
                    <span className="text-slate-500">₹{(row.data?.waived_amount ?? 0).toFixed(2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Consult fees and pharmacy charges are billed separately — "Pending" for consult fees includes link-sent and
          deferred payments still owed.
        </p>
      </Panel>
    </div>
  );
}
