import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { doctorApi } from "../api";
import { calcAge, formatDate, statusTone } from "../utils";
import type { DoctorPatient } from "../types";

export default function PatientsListPage() {
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    doctorApi
      .listPatients()
      .then((r) => setPatients(r.patients))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter((p) => p.full_name.toLowerCase().includes(query.toLowerCase()));

  const columns: Column<DoctorPatient>[] = [
    {
      header: "Name",
      render: (p) => (
        <Link to={`/doctor/patients/${p.id}`} className="font-medium text-doctor-accent hover:underline">
          {p.full_name}
        </Link>
      ),
    },
    { header: "Age / Gender", render: (p) => `${calcAge(p.date_of_birth)} / ${p.gender}` },
    { header: "Admission", render: (p) => <span className="capitalize">{p.admission_type}</span> },
    { header: "Ward", render: (p) => p.ward ?? "—" },
    { header: "Last Visit", render: (p) => (p.last_note_at ? formatDate(p.last_note_at) : "—") },
    { header: "Status", render: (p) => <Badge tone={statusTone(p.profile_status)}>{p.profile_status}</Badge> },
  ];

  return (
    <Panel
      title="My Patients"
      action={
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      }
    >
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <DataTable columns={columns} rows={filtered} keyFor={(p) => p.id} emptyMessage="No assigned patients." />
      )}
    </Panel>
  );
}
