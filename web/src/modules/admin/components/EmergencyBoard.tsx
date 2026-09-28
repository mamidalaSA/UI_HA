import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import type { Patient } from "../api";

interface EmergencyCase extends Patient {
  waitMinutes: number | null;
}

// Bounds the board to genuinely current cases. A real ER doesn't have active
// patients sitting for days — anything older is a stale record (transferred,
// discharged-but-not-updated, or leftover test data), not a live case.
const MAX_CASE_AGE_HOURS = 72;

function formatWait(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function waitTone(minutes: number | null): "green" | "amber" | "red" {
  if (minutes === null) return "green";
  if (minutes >= 240) return "red";
  if (minutes >= 60) return "amber";
  return "green";
}

interface EmergencyBoardProps {
  patients: Patient[];
  departmentNameById: Map<string, string>;
}

/** Live board of patients currently in the Emergency department, oldest wait
 * first — the same "who needs attention now" view an ER charge nurse would
 * want, surfaced for admin/doctor oversight without a separate module. */
export function EmergencyBoard({ patients, departmentNameById }: EmergencyBoardProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const cases: EmergencyCase[] = useMemo(() => {
    return patients
      .filter((p) => {
        if (p.profile_status !== "active") return false;
        if (!p.department_id || departmentNameById.get(p.department_id) !== "Emergency") return false;
        if (!p.admitted_at) return false;
        const ageHours = (now - new Date(p.admitted_at).getTime()) / 3_600_000;
        return ageHours <= MAX_CASE_AGE_HOURS;
      })
      .map((p) => ({
        ...p,
        waitMinutes: p.admitted_at ? Math.max(0, Math.round((now - new Date(p.admitted_at).getTime()) / 60000)) : null,
      }))
      .sort((a, b) => (b.waitMinutes ?? -1) - (a.waitMinutes ?? -1));
  }, [patients, departmentNameById, now]);

  const columns: Column<EmergencyCase>[] = [
    { header: "Patient", render: (c) => <span className="font-medium text-slate-800">{c.full_name}</span> },
    { header: "Type", render: (c) => <span className="capitalize">{c.admission_type}</span> },
    {
      header: "Payment",
      render: (c) => (
        <Badge tone={c.payment_status === "paid" ? "green" : c.payment_status === "waived" ? "blue" : "amber"}>
          {c.payment_status}
        </Badge>
      ),
    },
    {
      header: "Waiting",
      render: (c) => <Badge tone={waitTone(c.waitMinutes)}>{formatWait(c.waitMinutes)}</Badge>,
    },
  ];

  return (
    <div>
      <DataTable
        columns={columns}
        rows={cases}
        keyFor={(c) => c.id}
        emptyMessage="No active emergency cases right now"
      />
      <p className="mt-2 text-xs text-slate-400">
        Active patients currently in the Emergency department, longest-waiting first.
      </p>
    </div>
  );
}
