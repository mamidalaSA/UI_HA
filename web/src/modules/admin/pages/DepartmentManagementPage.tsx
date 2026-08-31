import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DataTable, type Column } from "@/components/DataTable";
import { IconPlus } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { Field, inputClass } from "../components/Field";
import {
  createDepartment,
  listDepartmentFees,
  listDepartments,
  updateDepartment,
  upsertDepartmentFee,
  type Department,
  type DepartmentFee,
} from "../api";

export default function DepartmentManagementPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [fees, setFees] = useState<DepartmentFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });

  const [feeDraft, setFeeDraft] = useState<Record<string, string>>({});
  const [savingFeeFor, setSavingFeeFor] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([listDepartments(), listDepartmentFees()])
      .then(([d, f]) => {
        setDepartments(d);
        setFees(f);
      })
      .catch((err) => setError(err?.response?.data?.detail ?? "Failed to load departments"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const feeByDept = useMemo(() => {
    const map = new Map<string, DepartmentFee>();
    for (const f of fees) map.set(f.department_id, f);
    return map;
  }, [fees]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", code: "" });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(dept: Department) {
    setEditing(dept);
    setForm({ name: dept.name, code: dept.code });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      if (editing) {
        await updateDepartment(editing.id, form);
      } else {
        await createDepartment(form);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail ?? "Failed to save department");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveFee(departmentId: string) {
    const raw = feeDraft[departmentId];
    const value = Number(raw);
    if (!raw || Number.isNaN(value) || value <= 0) return;
    setSavingFeeFor(departmentId);
    try {
      await upsertDepartmentFee(departmentId, value);
      load();
    } finally {
      setSavingFeeFor(null);
    }
  }

  const columns: Column<Department>[] = [
    { header: "Name", render: (d) => <span className="font-medium text-slate-800">{d.name}</span> },
    { header: "Code", render: (d) => d.code },
    {
      header: "Consult Fee (₹)",
      render: (d) => {
        const current = feeByDept.get(d.id);
        const draft = feeDraft[d.id] ?? (current ? String(current.consult_fee) : "");
        return (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="0.01"
              value={draft}
              onChange={(e) => setFeeDraft((prev) => ({ ...prev, [d.id]: e.target.value }))}
              className="w-24 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-admin-accent"
            />
            <button
              onClick={() => saveFee(d.id)}
              disabled={savingFeeFor === d.id}
              className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              {savingFeeFor === d.id ? "..." : "Save"}
            </button>
          </div>
        );
      },
    },
    {
      header: "Actions",
      render: (d) => (
        <button onClick={() => openEdit(d)} className="text-xs font-semibold text-admin-accent hover:underline">
          Edit
        </button>
      ),
    },
  ];

  return (
    <Panel
      title="Departments"
      action={
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-admin-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" /> Add Department
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <DataTable columns={columns} rows={departments} keyFor={(d) => d.id} emptyMessage={loading ? "Loading..." : "No departments yet"} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Department" : "Add Department"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Name">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Code">
            <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className={inputClass} />
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
              {submitting ? "Saving..." : editing ? "Save Changes" : "Create Department"}
            </button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}
