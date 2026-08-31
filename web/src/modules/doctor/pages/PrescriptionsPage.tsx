import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { doctorApi } from "../api";
import { formatDate } from "../utils";
import type { DoctorPatient, Prescription } from "../types";

interface Row {
  patient: DoctorPatient;
  rx: Prescription;
}

export default function PrescriptionsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // No spec endpoint lists prescriptions across all of a doctor's patients at
      // once, so we fan out per-patient over the (typically small) assigned list
      // and merge client-side.
      const { patients } = await doctorApi.listPatients();
      const lists = await Promise.all(patients.map((p) => doctorApi.getPrescriptions(p.id).catch(() => [])));
      if (cancelled) return;
      const merged = patients.flatMap((p, i) => lists[i].map((rx) => ({ patient: p, rx })));
      merged.sort((a, b) => +new Date(b.rx.created_at) - +new Date(a.rx.created_at));
      setRows(merged);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const columns: Column<Row>[] = [
    {
      header: "Patient",
      render: (r) => (
        <Link to={`/doctor/patients/${r.patient.id}`} className="font-medium text-doctor-accent hover:underline">
          {r.patient.full_name}
        </Link>
      ),
    },
    { header: "Version", render: (r) => `v${r.rx.version}` },
    { header: "Medicines", render: (r) => r.rx.lines.map((l) => l.medicine_name).join(", ") || "—" },
    { header: "Status", render: (r) => <Badge tone={r.rx.is_active ? "green" : "slate"}>{r.rx.is_active ? "Active" : "Archived"}</Badge> },
    { header: "Created", render: (r) => formatDate(r.rx.created_at) },
  ];

  return (
    <Panel title="Prescriptions">
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <DataTable columns={columns} rows={rows} keyFor={(r) => r.rx.id} emptyMessage="No prescriptions written yet." />
      )}
    </Panel>
  );
}
