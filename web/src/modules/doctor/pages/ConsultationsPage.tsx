import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { DataTable, type Column } from "@/components/DataTable";
import { doctorApi } from "../api";
import { formatDateTime } from "../utils";
import type { DoctorPatient, ExaminationNote } from "../types";

interface Row {
  patient: DoctorPatient;
  note: ExaminationNote;
}

export default function ConsultationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { patients } = await doctorApi.listPatients();
      const lists = await Promise.all(patients.map((p) => doctorApi.getNotes(p.id).catch(() => [])));
      const merged = patients.flatMap((p, i) => lists[i].map((note) => ({ patient: p, note })));
      merged.sort((a, b) => +new Date(b.note.created_at) - +new Date(a.note.created_at));
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
    { header: "Note", render: (r) => <span className="line-clamp-2 whitespace-pre-wrap">{r.note.note_text}</span> },
    { header: "Date", render: (r) => formatDateTime(r.note.created_at) },
    {
      header: "",
      render: (r) => (
        <Link
          to={`/doctor/patients/${r.patient.id}`}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <Panel title="Consultations">
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <DataTable columns={columns} rows={rows} keyFor={(r) => r.note.id} emptyMessage="No consultation notes yet." />
      )}
    </Panel>
  );
}
