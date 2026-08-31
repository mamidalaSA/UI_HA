import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { doctorApi } from "../api";
import { calcAge, formatDate, formatDateTime, statusTone, testStatusTone } from "../utils";
import type { DoctorPatient, ExaminationNote, Frequency, Prescription, PrescriptionLineInput, Route, TestOrder } from "../types";
import { TransferModal } from "../components/TransferModal";

const ROUTES: Route[] = ["oral", "IV", "IM", "topical", "inhalation"];
const FREQUENCIES: Frequency[] = ["once_daily", "twice_daily", "thrice_daily", "every_6h", "every_8h", "as_needed"];

function emptyLine(): PrescriptionLineInput {
  return {
    medicine_name: "",
    dosage: "",
    route: "oral",
    frequency: "once_daily",
    start_date: new Date().toISOString().slice(0, 10),
    duration_days: 5,
    with_food: false,
    special_instructions: "",
  };
}

function errorDetail(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<DoctorPatient | null>(null);
  const [notes, setNotes] = useState<ExaminationNote[]>([]);
  const [tests, setTests] = useState<TestOrder[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [testTypeId, setTestTypeId] = useState("");
  const [testNotes, setTestNotes] = useState("");
  const [orderingTest, setOrderingTest] = useState(false);

  const [rxNotes, setRxNotes] = useState("");
  const [lines, setLines] = useState<PrescriptionLineInput[]>([emptyLine()]);
  const [savingRx, setSavingRx] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [discharging, setDischarging] = useState(false);

  async function loadAll() {
    if (!id) return;
    try {
      const [list, notesData, testsData, rxData] = await Promise.all([
        doctorApi.listPatients(),
        doctorApi.getNotes(id).catch(() => []),
        doctorApi.getTests(id).catch(() => []),
        doctorApi.getPrescriptions(id).catch(() => []),
      ]);
      setPatient(list.patients.find((p) => p.id === id) ?? null);
      setNotes(notesData);
      setTests(testsData);
      setPrescriptions(rxData);
      setLoadError(null);
    } catch {
      setLoadError("Could not load patient record.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitNote(e: FormEvent) {
    e.preventDefault();
    if (!id || !noteText.trim()) return;
    setSavingNote(true);
    setActionError(null);
    try {
      await doctorApi.addNote(id, noteText.trim());
      setNoteText("");
      await loadAll();
    } catch (err) {
      setActionError(errorDetail(err, "Could not save note."));
    } finally {
      setSavingNote(false);
    }
  }

  async function submitTest(e: FormEvent) {
    e.preventDefault();
    if (!id || !testTypeId.trim()) return;
    setOrderingTest(true);
    setActionError(null);
    try {
      await doctorApi.orderTest(id, testTypeId.trim(), testNotes.trim() || undefined);
      setTestTypeId("");
      setTestNotes("");
      await loadAll();
    } catch (err) {
      setActionError(errorDetail(err, "Could not order test."));
    } finally {
      setOrderingTest(false);
    }
  }

  async function reviewTest(testId: string) {
    setActionError(null);
    try {
      await doctorApi.reviewTest(testId);
      await loadAll();
    } catch (err) {
      setActionError(errorDetail(err, "Could not mark test reviewed."));
    }
  }

  function updateLine(idx: number, patch: Partial<PrescriptionLineInput>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submitPrescription(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSavingRx(true);
    setActionError(null);
    try {
      await doctorApi.savePrescription(id, { notes: rxNotes.trim() || undefined, lines });
      setRxNotes("");
      setLines([emptyLine()]);
      await loadAll();
    } catch (err) {
      setActionError(errorDetail(err, "Could not save prescription."));
    } finally {
      setSavingRx(false);
    }
  }

  async function dischargePatient() {
    if (!id) return;
    if (!window.confirm("Discharge this patient? This cancels all pending dose alerts.")) return;
    setDischarging(true);
    setActionError(null);
    try {
      await doctorApi.discharge(id);
      await loadAll();
    } catch (err) {
      setActionError(errorDetail(err, "Could not discharge patient."));
    } finally {
      setDischarging(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading patient record…</p>;
  if (!patient) return <p className="text-sm text-red-600">{loadError ?? "Patient not found."}</p>;

  const noteColumns: Column<ExaminationNote>[] = [
    { header: "Date", render: (n) => formatDateTime(n.created_at) },
    { header: "Note", render: (n) => <span className="whitespace-pre-wrap">{n.note_text}</span> },
  ];

  const testColumns: Column<TestOrder>[] = [
    { header: "Test catalogue ID", render: (t) => <span className="font-mono text-xs">{t.test_type_id.slice(0, 8)}</span> },
    { header: "Status", render: (t) => <Badge tone={testStatusTone(t.status)}>{t.status.replace("_", " ")}</Badge> },
    { header: "Ordered", render: (t) => formatDateTime(t.ordered_at) },
    { header: "Result", render: (t) => t.result_text ?? "—" },
    {
      header: "",
      render: (t) =>
        t.status === "completed" ? (
          <button
            onClick={() => reviewTest(t.id)}
            className="rounded-md bg-doctor-accent px-2.5 py-1 text-xs font-semibold text-white"
          >
            Mark reviewed
          </button>
        ) : null,
    },
  ];

  const activeRx = prescriptions.find((rx) => rx.is_active);

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="text-sm font-medium text-doctor-accent hover:underline">
        ← Back
      </button>

      <Panel
        title={patient.full_name}
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setTransferOpen(true)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Transfer patient
            </button>
            <button
              onClick={dischargePatient}
              disabled={discharging || patient.profile_status === "discharged"}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {patient.profile_status === "discharged" ? "Discharged" : discharging ? "Discharging…" : "Discharge patient"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-5">
          <div>
            <p className="text-slate-400">Age / Gender</p>
            <p className="font-medium text-slate-800">
              {calcAge(patient.date_of_birth)} / {patient.gender}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Admission</p>
            <p className="font-medium capitalize text-slate-800">{patient.admission_type}</p>
          </div>
          <div>
            <p className="text-slate-400">Ward</p>
            <p className="font-medium text-slate-800">{patient.ward ?? "—"}</p>
          </div>
          <div>
            <p className="text-slate-400">Admitted</p>
            <p className="font-medium text-slate-800">{patient.admitted_at ? formatDate(patient.admitted_at) : "—"}</p>
          </div>
          <div>
            <p className="text-slate-400">Status</p>
            <Badge tone={statusTone(patient.profile_status)}>{patient.profile_status}</Badge>
          </div>
        </div>
        {actionError && <p className="mt-3 text-sm font-medium text-red-600">{actionError}</p>}
      </Panel>

      <Panel title="Examination Notes">
        <form onSubmit={submitNote} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={2}
            placeholder="Add an examination note…"
            required
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={savingNote}
            className="self-start rounded-lg bg-doctor-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:self-end"
          >
            {savingNote ? "Saving…" : "Add note"}
          </button>
        </form>
        <DataTable columns={noteColumns} rows={notes} keyFor={(n) => n.id} emptyMessage="No examination notes yet." />
      </Panel>

      <Panel title="Tests & Scans">
        <form onSubmit={submitTest} className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            value={testTypeId}
            onChange={(e) => setTestTypeId(e.target.value)}
            placeholder="Test catalogue ID (UUID)"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            value={testNotes}
            onChange={(e) => setTestNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={orderingTest}
            className="rounded-lg bg-doctor-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {orderingTest ? "Ordering…" : "Order test"}
          </button>
        </form>
        <p className="mb-3 text-xs text-slate-400">
          No test-catalogue lookup endpoint is exposed to the doctor role — paste the catalogue entry's ID directly.
        </p>
        <DataTable columns={testColumns} rows={tests} keyFor={(t) => t.id} emptyMessage="No tests ordered yet." />
      </Panel>

      <Panel title="Prescriptions">
        <form onSubmit={submitPrescription} className="mb-5 space-y-3 rounded-lg border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-700">
            {activeRx ? `Revise prescription (currently v${activeRx.version})` : "New prescription"}
          </p>
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-4">
              <input
                value={line.medicine_name}
                onChange={(e) => updateLine(idx, { medicine_name: e.target.value })}
                placeholder="Medicine name"
                required
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                value={line.dosage}
                onChange={(e) => updateLine(idx, { dosage: e.target.value })}
                placeholder="Dosage e.g. 500mg"
                required
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <select
                value={line.route}
                onChange={(e) => updateLine(idx, { route: e.target.value as Route })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {ROUTES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={line.frequency}
                onChange={(e) => updateLine(idx, { frequency: e.target.value as Frequency })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f.replace("_", " ")}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={line.start_date}
                onChange={(e) => updateLine(idx, { start_date: e.target.value })}
                required
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min={1}
                value={line.duration_days}
                onChange={(e) => updateLine(idx, { duration_days: Number(e.target.value) })}
                placeholder="Duration (days)"
                required
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={line.with_food}
                  onChange={(e) => updateLine(idx, { with_food: e.target.checked })}
                />
                With food
              </label>
              <input
                value={line.special_instructions}
                onChange={(e) => updateLine(idx, { special_instructions: e.target.value })}
                placeholder="Special instructions"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm sm:col-span-2"
              />
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="text-xs font-semibold text-red-600 hover:underline sm:col-span-4 sm:text-right"
                >
                  Remove medicine
                </button>
              )}
            </div>
          ))}
          <button type="button" onClick={addLine} className="text-sm font-semibold text-doctor-accent hover:underline">
            + Add another medicine
          </button>
          <textarea
            value={rxNotes}
            onChange={(e) => setRxNotes(e.target.value)}
            rows={2}
            placeholder="General prescription notes (optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={savingRx}
            className="rounded-lg bg-doctor-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {savingRx ? "Saving…" : activeRx ? "Save as new version" : "Save prescription"}
          </button>
        </form>

        <div className="space-y-3">
          {prescriptions.length === 0 && <p className="text-sm text-slate-400">No prescriptions on record.</p>}
          {prescriptions.map((rx) => (
            <div key={rx.id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">
                  Version {rx.version} · {formatDate(rx.created_at)}
                </p>
                <Badge tone={rx.is_active ? "green" : "slate"}>{rx.is_active ? "Active" : "Archived"}</Badge>
              </div>
              <ul className="space-y-1 text-sm text-slate-600">
                {rx.lines.map((line) => (
                  <li key={line.id}>
                    {line.medicine_name} — {line.dosage}, {line.route}, {line.frequency.replace("_", " ")}, {line.duration_days}d from{" "}
                    {formatDate(line.start_date)}
                    {line.with_food ? " (with food)" : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      {id && (
        <TransferModal patientId={id} open={transferOpen} onClose={() => setTransferOpen(false)} onDone={loadAll} />
      )}
    </div>
  );
}
