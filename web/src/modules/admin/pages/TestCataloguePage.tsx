import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DataTable, type Column } from "@/components/DataTable";
import { IconPlus } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { Field, inputClass } from "../components/Field";
import {
  createTestCatalogueEntry,
  listDepartments,
  listTestCatalogue,
  updateTestCatalogueEntry,
  type Department,
  type TestCatalogueEntry,
} from "../api";

const EMPTY_FORM = { name: "", department_id: "", category: "", tat_min_hours: "", tat_max_hours: "" };

export default function TestCataloguePage() {
  const [entries, setEntries] = useState<TestCatalogueEntry[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TestCatalogueEntry | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function load() {
    setLoading(true);
    Promise.all([listTestCatalogue(), listDepartments().catch(() => [])])
      .then(([e, d]) => {
        setEntries(e);
        setDepartments(d);
      })
      .catch((err) => setError(err?.response?.data?.detail ?? "Failed to load test catalogue"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) map.set(d.id, d.name);
    return map;
  }, [departments]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(entry: TestCatalogueEntry) {
    setEditing(entry);
    setForm({
      name: entry.name,
      department_id: entry.department_id,
      category: entry.category,
      tat_min_hours: String(entry.tat_min_hours),
      tat_max_hours: String(entry.tat_max_hours),
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const tatMin = Number(form.tat_min_hours);
    const tatMax = Number(form.tat_max_hours);
    if (!form.department_id) {
      setFormError("Department is required");
      return;
    }
    if (Number.isNaN(tatMin) || Number.isNaN(tatMax) || tatMin <= 0 || tatMax <= 0) {
      setFormError("TAT hours must be positive numbers");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        department_id: form.department_id,
        category: form.category,
        tat_min_hours: tatMin,
        tat_max_hours: tatMax,
      };
      if (editing) {
        await updateTestCatalogueEntry(editing.id, payload);
      } else {
        await createTestCatalogueEntry(payload);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail ?? "Failed to save test catalogue entry");
    } finally {
      setSubmitting(false);
    }
  }

  const columns: Column<TestCatalogueEntry>[] = [
    { header: "Test Name", render: (t) => <span className="font-medium text-slate-800">{t.name}</span> },
    { header: "Department", render: (t) => departmentNameById.get(t.department_id) ?? "—" },
    { header: "Category", render: (t) => t.category },
    { header: "TAT (hours)", render: (t) => `${t.tat_min_hours} – ${t.tat_max_hours}` },
    {
      header: "Actions",
      render: (t) => (
        <button onClick={() => openEdit(t)} className="text-xs font-semibold text-admin-accent hover:underline">
          Edit
        </button>
      ),
    },
  ];

  return (
    <Panel
      title="Test Catalogue"
      action={
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-admin-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" /> Add Test
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <DataTable columns={columns} rows={entries} keyFor={(t) => t.id} emptyMessage={loading ? "Loading..." : "No tests configured"} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Test" : "Add Test"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Test name">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
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
          <Field label="Category">
            <input
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="e.g. Pathology, Radiology"
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min TAT (hours)">
              <input
                required
                type="number"
                min={0}
                step="0.1"
                value={form.tat_min_hours}
                onChange={(e) => setForm({ ...form, tat_min_hours: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Max TAT (hours)">
              <input
                required
                type="number"
                min={0}
                step="0.1"
                value={form.tat_max_hours}
                onChange={(e) => setForm({ ...form, tat_max_hours: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
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
              {submitting ? "Saving..." : editing ? "Save Changes" : "Create Test"}
            </button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}
