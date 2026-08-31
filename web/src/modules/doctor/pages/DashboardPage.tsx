import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/StatCard";
import { Panel } from "@/components/Panel";
import { DataTable, type Column } from "@/components/DataTable";
import { Badge } from "@/components/Badge";
import { IconUsers, IconFlask, IconClipboard, IconCalendar } from "@/components/icons";
import { doctorApi } from "../api";
import { calcAge, formatDate, statusTone, testStatusTone } from "../utils";
import type { DoctorPatient, ExaminationNote, Prescription, TestOrder } from "../types";
import { IncomingTransfersPanel } from "../components/IncomingTransfersPanel";

interface RxRow {
  patient: DoctorPatient;
  rx: Prescription;
}
interface TestRow {
  patient: DoctorPatient;
  test: TestOrder;
}
interface NoteRow {
  patient: DoctorPatient;
  note: ExaminationNote;
}

export default function DashboardPage() {
  const [patients, setPatients] = useState<DoctorPatient[]>([]);
  const [pendingReports, setPendingReports] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recentRx, setRecentRx] = useState<RxRow[]>([]);
  const [pendingTests, setPendingTests] = useState<TestRow[]>([]);
  const [recentNotes, setRecentNotes] = useState<NoteRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const list = await doctorApi.listPatients();
      if (cancelled) return;
      setPatients(list.patients);
      setPendingReports(list.pending_reports_count);

      // The spec's Doctor endpoints have no "across all my patients" list for
      // prescriptions/tests/notes, so these summary tables fan out per-patient
      // (capped to the first 12) and merge client-side. Fine at the small,
      // single-doctor scale this dashboard targets.
      const sample = list.patients.slice(0, 12);
      const [rxLists, testLists, noteLists] = await Promise.all([
        Promise.all(sample.map((p) => doctorApi.getPrescriptions(p.id).catch(() => []))),
        Promise.all(sample.map((p) => doctorApi.getTests(p.id).catch(() => []))),
        Promise.all(sample.map((p) => doctorApi.getNotes(p.id).catch(() => []))),
      ]);
      if (cancelled) return;

      const rxRows = sample.flatMap((p, i) => rxLists[i].map((rx) => ({ patient: p, rx })));
      rxRows.sort((a, b) => +new Date(b.rx.created_at) - +new Date(a.rx.created_at));
      setRecentRx(rxRows.slice(0, 5));

      const testRows = sample.flatMap((p, i) =>
        testLists[i]
          .filter((t) => t.status === "pending" || t.status === "in_progress" || t.status === "completed")
          .map((t) => ({ patient: p, test: t }))
      );
      testRows.sort((a, b) => +new Date(b.test.ordered_at) - +new Date(a.test.ordered_at));
      setPendingTests(testRows.slice(0, 5));

      const noteRows = sample.flatMap((p, i) => noteLists[i].map((n) => ({ patient: p, note: n })));
      noteRows.sort((a, b) => +new Date(b.note.created_at) - +new Date(a.note.created_at));
      setRecentNotes(noteRows.slice(0, 5));

      setLoading(false);
    }
    load().catch(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const patientColumns: Column<DoctorPatient>[] = [
    {
      header: "Name",
      render: (p) => (
        <Link to={`/doctor/patients/${p.id}`} className="font-medium text-doctor-accent hover:underline">
          {p.full_name}
        </Link>
      ),
    },
    { header: "Age / Gender", render: (p) => `${calcAge(p.date_of_birth)} / ${p.gender}` },
    { header: "Last Visit", render: (p) => (p.last_note_at ? formatDate(p.last_note_at) : "—") },
    { header: "Status", render: (p) => <Badge tone={statusTone(p.profile_status)}>{p.profile_status}</Badge> },
  ];

  const rxColumns: Column<RxRow>[] = [
    {
      header: "Patient",
      render: (r) => (
        <Link to={`/doctor/patients/${r.patient.id}`} className="font-medium text-doctor-accent hover:underline">
          {r.patient.full_name}
        </Link>
      ),
    },
    { header: "Medicines", render: (r) => r.rx.lines.map((l) => l.medicine_name).join(", ") || "—" },
    { header: "Version", render: (r) => `v${r.rx.version}` },
    { header: "Date", render: (r) => formatDate(r.rx.created_at) },
  ];

  const testColumns: Column<TestRow>[] = [
    {
      header: "Patient",
      render: (r) => (
        <Link to={`/doctor/patients/${r.patient.id}`} className="font-medium text-doctor-accent hover:underline">
          {r.patient.full_name}
        </Link>
      ),
    },
    { header: "Status", render: (r) => <Badge tone={testStatusTone(r.test.status)}>{r.test.status.replace("_", " ")}</Badge> },
    { header: "Ordered", render: (r) => formatDate(r.test.ordered_at) },
  ];

  const noteColumns: Column<NoteRow>[] = [
    {
      header: "Patient",
      render: (r) => (
        <Link to={`/doctor/patients/${r.patient.id}`} className="font-medium text-doctor-accent hover:underline">
          {r.patient.full_name}
        </Link>
      ),
    },
    { header: "Note", render: (r) => <span className="line-clamp-1">{r.note.note_text}</span> },
    { header: "Date", render: (r) => formatDate(r.note.created_at) },
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
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<IconUsers className="h-6 w-6 text-white" />}
          iconBg="bg-doctor-accent"
          label="My Patients"
          value={loading ? "—" : patients.length}
          linkTo="/doctor/patients"
        />
        <StatCard
          icon={<IconFlask className="h-6 w-6 text-white" />}
          iconBg="bg-amber-500"
          label="Pending Reports"
          value={loading ? "—" : pendingReports}
          linkTo="/doctor/tests"
        />
        {/* Demo-only: not backed by any endpoint in this spec. */}
        <StatCard
          icon={<IconClipboard className="h-6 w-6 text-white" />}
          iconBg="bg-blue-500"
          label="New Consultations"
          value={3}
        />
        {/* Demo-only: not backed by any endpoint in this spec. */}
        <StatCard
          icon={<IconCalendar className="h-6 w-6 text-white" />}
          iconBg="bg-purple-500"
          label="Today's Appointments"
          value={6}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="My Patients" action={<Link to="/doctor/patients" className="text-xs font-semibold text-doctor-accent hover:underline">View all</Link>}>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : (
              <DataTable columns={patientColumns} rows={patients.slice(0, 6)} keyFor={(p) => p.id} emptyMessage="No assigned patients." />
            )}
          </Panel>

          <Panel title="Recent Prescriptions" action={<Link to="/doctor/prescriptions" className="text-xs font-semibold text-doctor-accent hover:underline">View all</Link>}>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : (
              <DataTable columns={rxColumns} rows={recentRx} keyFor={(r) => r.rx.id} emptyMessage="No prescriptions yet." />
            )}
          </Panel>

          <Panel title="Pending Tests & Scans" action={<Link to="/doctor/tests" className="text-xs font-semibold text-doctor-accent hover:underline">View all</Link>}>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : (
              <DataTable columns={testColumns} rows={pendingTests} keyFor={(r) => r.test.id} emptyMessage="No pending tests." />
            )}
          </Panel>

          <Panel title="Recent Consultations / Notes" action={<Link to="/doctor/consultations" className="text-xs font-semibold text-doctor-accent hover:underline">View all</Link>}>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : (
              <DataTable columns={noteColumns} rows={recentNotes} keyFor={(r) => r.note.id} emptyMessage="No consultation notes yet." />
            )}
          </Panel>
        </div>

        <div>
          <IncomingTransfersPanel />
        </div>
      </div>
    </div>
  );
}
