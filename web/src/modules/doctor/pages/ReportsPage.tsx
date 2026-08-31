import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { DataTable, type Column } from "@/components/DataTable";
import { doctorApi } from "../api";
import { formatDateTime } from "../utils";
import type { DoctorPatient, TestOrder } from "../types";

// "Reports" has no dedicated entity in the spec. The closest real data is this
// doctor's test orders that have results back (completed or already reviewed),
// so that's what this page shows — demo-level derivation, noted per the task.
interface Row {
  patient: DoctorPatient;
  test: TestOrder;
}

export default function ReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { patients } = await doctorApi.listPatients();
      const lists = await Promise.all(patients.map((p) => doctorApi.getTests(p.id).catch(() => [])));
      const merged = patients
        .flatMap((p, i) => lists[i].map((test) => ({ patient: p, test })))
        .filter((r) => r.test.status === "completed" || r.test.status === "reviewed");
      merged.sort(
        (a, b) => +new Date(b.test.completed_at ?? b.test.ordered_at) - +new Date(a.test.completed_at ?? a.test.ordered_at)
      );
      setRows(merged);
      setLoading(false);
    }
    load();
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
    { header: "Test catalogue ID", render: (r) => <span className="font-mono text-xs">{r.test.test_type_id.slice(0, 8)}</span> },
    { header: "Result", render: (r) => r.test.result_text ?? "—" },
    { header: "Completed", render: (r) => (r.test.completed_at ? formatDateTime(r.test.completed_at) : "—") },
  ];

  return (
    <Panel title="Reports">
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <DataTable columns={columns} rows={rows} keyFor={(r) => r.test.id} emptyMessage="No completed reports yet." />
      )}
    </Panel>
  );
}
