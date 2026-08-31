import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { doctorApi } from "../api";
import { formatDateTime, testStatusTone } from "../utils";
import type { DoctorPatient, TestOrder } from "../types";

interface Row {
  patient: DoctorPatient;
  test: TestOrder;
}

export default function TestsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { patients } = await doctorApi.listPatients();
    const lists = await Promise.all(patients.map((p) => doctorApi.getTests(p.id).catch(() => [])));
    const merged = patients.flatMap((p, i) => lists[i].map((test) => ({ patient: p, test })));
    merged.sort((a, b) => +new Date(b.test.ordered_at) - +new Date(a.test.ordered_at));
    setRows(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function review(id: string) {
    await doctorApi.reviewTest(id);
    await load();
  }

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
    { header: "Status", render: (r) => <Badge tone={testStatusTone(r.test.status)}>{r.test.status.replace("_", " ")}</Badge> },
    { header: "Ordered", render: (r) => formatDateTime(r.test.ordered_at) },
    {
      header: "",
      render: (r) =>
        r.test.status === "completed" ? (
          <button
            onClick={() => review(r.test.id)}
            className="rounded-md bg-doctor-accent px-2.5 py-1 text-xs font-semibold text-white"
          >
            Mark reviewed
          </button>
        ) : null,
    },
  ];

  return (
    <Panel title="Tests & Scans">
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <DataTable columns={columns} rows={rows} keyFor={(r) => r.test.id} emptyMessage="No tests ordered yet." />
      )}
    </Panel>
  );
}
