import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, type Column } from "@/components/DataTable";
import type { DoctorStats } from "../api";

// Diverging pair from the house palette (blue <-> red): net_contribution's sign
// is the thing being encoded, not an arbitrary series, so only these two slots
// are used — never the categorical department palette.
const POSITIVE = "#2a78d6";
const NEGATIVE = "#e34948";

function money(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

interface DoctorLeaderboardProps {
  doctors: DoctorStats[];
}

/** Per-doctor revenue vs. salary — the one number most hospital software never
 * surfaces: who's net-profitable for the hospital and by how much, all-time. */
export function DoctorLeaderboard({ doctors }: DoctorLeaderboardProps) {
  const sorted = useMemo(
    () => [...doctors].sort((a, b) => b.net_contribution - a.net_contribution),
    [doctors]
  );

  const chartData = useMemo(
    () =>
      sorted.map((d) => ({
        name: d.full_name.replace(/^Dr\.\s*/, ""),
        net_contribution: d.net_contribution,
      })),
    [sorted]
  );

  const columns: Column<DoctorStats>[] = [
    {
      header: "Doctor",
      render: (d) => (
        <div>
          <p className="font-medium text-slate-800">{d.full_name}</p>
          <p className="text-xs text-slate-400">{d.specialty}</p>
        </div>
      ),
    },
    { header: "Patients", render: (d) => d.patients_count },
    { header: "Revenue Collected", render: (d) => <span className="text-slate-700">{money(d.income_paid)}</span> },
    { header: "Salary Paid", render: (d) => <span className="text-slate-700">{money(d.salary_paid)}</span> },
    {
      header: "Net",
      render: (d) => (
        <span className={`font-semibold ${d.net_contribution >= 0 ? "text-blue-700" : "text-red-600"}`}>
          {money(d.net_contribution)}
        </span>
      ),
    },
  ];

  if (doctors.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">No doctors yet</p>;
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: POSITIVE }} />
          Net positive (revenue &gt; salary)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: NEGATIVE }} />
          Net negative
        </span>
      </div>

      <div style={{ height: Math.max(160, chartData.length * 36) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
            barCategoryGap={10}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "#898781" }}
              axisLine={{ stroke: "#c3c2b7" }}
              tickLine={false}
              tickFormatter={(v: number) => money(v)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={92}
              tick={{ fontSize: 12, fill: "#52514e" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip formatter={(value: number) => [money(value), "Net contribution"]} />
            <Bar dataKey="net_contribution" radius={[4, 4, 4, 4]} barSize={16}>
              {chartData.map((d) => (
                <Cell key={d.name} fill={d.net_contribution >= 0 ? POSITIVE : NEGATIVE} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4">
        <DataTable columns={columns} rows={sorted} keyFor={(d) => d.doctor_id} />
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Revenue = consult fees collected from each doctor's assigned patients. Net = revenue minus salary paid,
        all-time — not scoped to a single month.
      </p>
    </div>
  );
}
