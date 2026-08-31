import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { IconPlus } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { Field, inputClass } from "../components/Field";
import {
  createUser,
  listDepartments,
  listDoctorRoster,
  listDoctors,
  updateUser,
  upsertDoctorRoster,
  type Department,
  type Doctor,
  type DoctorRoster,
} from "../api";

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

interface RosterRow {
  is_on_duty: boolean;
  max_patients: number;
  saving: boolean;
}

function defaultRosterRows(): RosterRow[] {
  return DAY_LABELS.map(() => ({ is_on_duty: true, max_patients: 20, saving: false }));
}

export default function DoctorManagementPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    full_name: "",
    phone: "",
    department_id: "",
    specialty: "",
  });

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [rosterRows, setRosterRows] = useState<RosterRow[]>(defaultRosterRows());
  const [rosterLoading, setRosterLoading] = useState(false);

  function loadDoctors() {
    setLoading(true);
    Promise.all([listDoctors(), listDepartments().catch(() => [])])
      .then(([d, dept]) => {
        setDoctors(d);
        setDepartments(dept);
      })
      .catch((err) => setError(err?.response?.data?.detail ?? "Failed to load doctors"))
      .finally(() => setLoading(false));
  }

  useEffect(loadDoctors, []);

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) map.set(d.id, d.name);
    return map;
  }, [departments]);

  useEffect(() => {
    if (!selectedDoctorId) return;
    setRosterLoading(true);
    listDoctorRoster(selectedDoctorId)
      .then((rows) => {
        const byDay = new Map(rows.map((r): [number, DoctorRoster] => [r.day_of_week, r]));
        setRosterRows(
          DAY_LABELS.map((_, day) => {
            const existing = byDay.get(day);
            return {
              is_on_duty: existing?.is_on_duty ?? true,
              max_patients: existing?.max_patients ?? 20,
              saving: false,
            };
          })
        );
      })
      .finally(() => setRosterLoading(false));
  }, [selectedDoctorId]);

  async function handleCreateDoctor(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.department_id || !form.specialty) {
      setFormError("Department and specialty are required for a doctor account");
      return;
    }
    setSubmitting(true);
    try {
      await createUser({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone || null,
        role: "doctor",
        department_id: form.department_id,
        specialty: form.specialty,
      });
      setModalOpen(false);
      setForm({ email: "", password: "", full_name: "", phone: "", department_id: "", specialty: "" });
      loadDoctors();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail ?? "Failed to create doctor account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(doctor: Doctor) {
    try {
      await updateUser(doctor.user_id, { is_active: !doctor.is_active });
      loadDoctors();
    } catch (err) {
      // no-op — table just won't reflect the change
    }
  }

  async function saveRosterRow(day: number) {
    if (!selectedDoctorId) return;
    setRosterRows((rows) => rows.map((r, i) => (i === day ? { ...r, saving: true } : r)));
    try {
      await upsertDoctorRoster({
        doctor_id: selectedDoctorId,
        day_of_week: day,
        is_on_duty: rosterRows[day].is_on_duty,
        max_patients: rosterRows[day].max_patients,
      });
    } finally {
      setRosterRows((rows) => rows.map((r, i) => (i === day ? { ...r, saving: false } : r)));
    }
  }

  const columns: Column<Doctor>[] = [
    { header: "Name", render: (d) => <span className="font-medium text-slate-800">{d.full_name}</span> },
    { header: "Email", render: (d) => d.email },
    { header: "Department", render: (d) => departmentNameById.get(d.department_id) ?? "—" },
    { header: "Specialty", render: (d) => d.specialty },
    {
      header: "Status",
      render: (d) => <Badge tone={d.is_active ? "green" : "slate"}>{d.is_active ? "Active" : "Inactive"}</Badge>,
    },
    {
      header: "Actions",
      render: (d) => (
        <button
          onClick={() => handleToggleActive(d)}
          className="text-xs font-semibold text-admin-accent hover:underline"
        >
          {d.is_active ? "Deactivate" : "Activate"}
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Doctors"
        action={
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-admin-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            <IconPlus className="h-4 w-4" /> Add Doctor
          </button>
        }
      >
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <DataTable columns={columns} rows={doctors} keyFor={(d) => d.id} emptyMessage={loading ? "Loading..." : "No doctors yet"} />
      </Panel>

      <Panel title="Weekly Duty Roster">
        <div className="mb-4 max-w-xs">
          <label className="mb-1 block text-xs font-medium text-slate-500">Select doctor</label>
          <select
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-admin-accent"
          >
            <option value="">Choose a doctor...</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name} — {d.specialty}
              </option>
            ))}
          </select>
        </div>

        {selectedDoctorId && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2.5">Day</th>
                  <th className="px-3 py-2.5">On Duty</th>
                  <th className="px-3 py-2.5">Max Patients</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {DAY_LABELS.map((label, day) => (
                  <tr key={label} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2.5 text-slate-700">{label}</td>
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={rosterRows[day]?.is_on_duty ?? true}
                        disabled={rosterLoading}
                        onChange={(e) =>
                          setRosterRows((rows) =>
                            rows.map((r, i) => (i === day ? { ...r, is_on_duty: e.target.checked } : r))
                          )
                        }
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number"
                        min={1}
                        value={rosterRows[day]?.max_patients ?? 20}
                        disabled={rosterLoading}
                        onChange={(e) =>
                          setRosterRows((rows) =>
                            rows.map((r, i) => (i === day ? { ...r, max_patients: Number(e.target.value) } : r))
                          )
                        }
                        className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-admin-accent"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => saveRosterRow(day)}
                        disabled={rosterRows[day]?.saving}
                        className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                      >
                        {rosterRows[day]?.saving ? "Saving..." : "Save"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Doctor">
        <form onSubmit={handleCreateDoctor} className="flex flex-col gap-3">
          <Field label="Full name">
            <input
              required
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Email">
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Password">
            <input
              required
              type="password"
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Department">
            <select
              required
              value={form.department_id}
              onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Select department...</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Specialty">
            <input
              required
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              className={inputClass}
            />
          </Field>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg px-4 py-2 text-sm text-slate-600">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {submitting ? "Creating..." : "Create Doctor"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
