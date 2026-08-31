import { useEffect, useState, type FormEvent } from "react";
import { DataTable, type Column } from "@/components/DataTable";
import { IconPlus } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { Field, inputClass } from "../components/Field";
import {
  createDepartmentSpecialty,
  createSpecialtyMapping,
  deleteSpecialtyMapping,
  listDepartmentSpecialty,
  listDepartments,
  listSpecialtyMapping,
  type Department,
  type DepartmentSpecialty,
  type SpecialtyMapping,
} from "../api";

export default function SpecialtyMappingPage() {
  const [rows, setRows] = useState<SpecialtyMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ keyword: "", specialty: "" });

  function load() {
    setLoading(true);
    listSpecialtyMapping()
      .then(setRows)
      .catch((err) => setError(err?.response?.data?.detail ?? "Failed to load specialty mapping"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createSpecialtyMapping(form);
      setModalOpen(false);
      setForm({ keyword: "", specialty: "" });
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail ?? "Failed to save mapping");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSpecialtyMapping(id);
      load();
    } catch {
      // no-op
    }
  }

  const columns: Column<SpecialtyMapping>[] = [
    { header: "Keyword", render: (r) => <span className="font-medium text-slate-800">{r.keyword}</span> },
    { header: "Specialty", render: (r) => r.specialty },
    {
      header: "Actions",
      render: (r) => (
        <button onClick={() => handleDelete(r.id)} className="text-xs font-semibold text-red-600 hover:underline">
          Delete
        </button>
      ),
    },
  ];

  return (
    <Panel
      title="Specialty Mapping"
      action={
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-admin-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" /> Add Mapping
        </button>
      }
    >
      <p className="mb-4 text-sm text-slate-500">
        Keyword matched against a patient's chief complaint text, mapped to a specialty — the first hop of
        auto-assignment (specialty then maps to a department via Department-Specialty).
      </p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <DataTable columns={columns} rows={rows} keyFor={(r) => r.id} emptyMessage={loading ? "Loading..." : "No mappings yet"} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Specialty Mapping">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Keyword">
            <input
              required
              value={form.keyword}
              onChange={(e) => setForm({ ...form, keyword: e.target.value })}
              placeholder="e.g. chest pain"
              className={inputClass}
            />
          </Field>
          <Field label="Specialty">
            <input
              required
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              placeholder="e.g. Cardiology"
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
              {submitting ? "Saving..." : "Add Mapping"}
            </button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}

function DepartmentSpecialtySection() {
  const [rows, setRows] = useState<DepartmentSpecialty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ specialty: "", department_id: "" });

  function load() {
    setLoading(true);
    Promise.all([listDepartmentSpecialty(), listDepartments()])
      .then(([r, d]) => {
        setRows(r);
        setDepartments(d);
      })
      .catch((err) => setError(err?.response?.data?.detail ?? "Failed to load department-specialty mapping"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const departmentNameById = new Map(departments.map((d): [string, string] => [d.id, d.name]));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createDepartmentSpecialty(form);
      setModalOpen(false);
      setForm({ specialty: "", department_id: "" });
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail ?? "Failed to save mapping");
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<DepartmentSpecialty>[] = [
    { header: "Specialty", render: (r) => <span className="font-medium text-slate-800">{r.specialty}</span> },
    { header: "Department", render: (r) => departmentNameById.get(r.department_id) ?? "—" },
  ];

  return (
    <Panel
      title="Department-Specialty Mapping"
      action={
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-admin-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" /> Add Mapping
        </button>
      }
    >
      <p className="mb-4 text-sm text-slate-500">
        Second hop of auto-assignment: which department a matched specialty routes to.
      </p>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <DataTable columns={columns} rows={rows} keyFor={(r) => r.id} emptyMessage={loading ? "Loading..." : "No mappings yet"} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Department-Specialty Mapping">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Specialty">
            <input
              required
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
              placeholder="e.g. Cardiology"
              className={inputClass}
            />
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
              {submitting ? "Saving..." : "Add Mapping"}
            </button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}

export function SpecialtyMappingWithDepartments() {
  return (
    <div className="flex flex-col gap-6">
      <SpecialtyMappingPage />
      <DepartmentSpecialtySection />
    </div>
  );
}
