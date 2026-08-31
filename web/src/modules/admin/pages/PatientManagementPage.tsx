import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Panel } from "@/components/Panel";
import { listDepartments, listPatients, type Department, type Patient, type ProfileStatus } from "../api";

const STATUS_TONE: Record<ProfileStatus, "green" | "blue" | "amber" | "red" | "slate"> = {
  draft: "slate",
  pending: "amber",
  active: "green",
  discharged: "blue",
  expired: "red",
};

/** Read-only patient list for Admin. Reuses GET /api/patients (owned by the
 * Reception module) rather than duplicating reception's registration form. */
export default function PatientManagementPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPatients(), listDepartments().catch(() => [])])
      .then(([p, d]) => {
        if (cancelled) return;
        setPatients(p);
        setDepartments(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? "Failed to load patients");
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => p.full_name.toLowerCase().includes(q) || p.mobile.includes(q));
  }, [patients, query]);

  const columns: Column<Patient>[] = [
    { header: "Name", render: (p) => <span className="font-medium text-slate-800">{p.full_name}</span> },
    { header: "Mobile", render: (p) => p.mobile },
    { header: "Gender", render: (p) => p.gender },
    {
      header: "Department",
      render: (p) => (p.department_id ? departmentNameById.get(p.department_id) ?? "—" : "—"),
    },
    { header: "Admission Type", render: (p) => <span className="capitalize">{p.admission_type}</span> },
    {
      header: "Status",
      render: (p) => <Badge tone={STATUS_TONE[p.profile_status]}>{p.profile_status}</Badge>,
    },
    { header: "Payment", render: (p) => <span className="capitalize">{p.payment_status.replace("_", " ")}</span> },
    {
      header: "Admitted",
      render: (p) => (p.admitted_at ? new Date(p.admitted_at).toLocaleDateString() : "—"),
    },
  ];

  return (
    <Panel
      title="All Patients"
      action={
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by name or mobile..."
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-admin-accent"
        />
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <DataTable columns={columns} rows={filtered} keyFor={(p) => p.id} emptyMessage={loading ? "Loading..." : "No patients found"} />
    </Panel>
  );
}
