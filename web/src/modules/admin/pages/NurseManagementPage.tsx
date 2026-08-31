import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { IconPlus } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { Field, inputClass } from "../components/Field";
import { createUser, listUsers, updateUser, type User } from "../api";

export default function NurseManagementPage() {
  const [nurses, setNurses] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", ward: "" });

  function load() {
    setLoading(true);
    listUsers("head_nurse")
      .then(setNurses)
      .catch((err) => setError(err?.response?.data?.detail ?? "Failed to load nurses"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.ward.trim()) {
      setFormError("Ward is required for a head nurse account");
      return;
    }
    setSubmitting(true);
    try {
      await createUser({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone || null,
        role: "head_nurse",
        ward: form.ward,
      });
      setModalOpen(false);
      setForm({ email: "", password: "", full_name: "", phone: "", ward: "" });
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail ?? "Failed to create nurse account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(nurse: User) {
    try {
      await updateUser(nurse.id, { is_active: !nurse.is_active });
      load();
    } catch {
      // no-op
    }
  }

  const columns: Column<User>[] = [
    { header: "Name", render: (u) => <span className="font-medium text-slate-800">{u.full_name}</span> },
    { header: "Email", render: (u) => u.email },
    { header: "Phone", render: (u) => u.phone ?? "—" },
    { header: "Ward", render: (u) => u.ward ?? "—" },
    {
      header: "Status",
      render: (u) => <Badge tone={u.is_active ? "green" : "slate"}>{u.is_active ? "Active" : "Inactive"}</Badge>,
    },
    {
      header: "Actions",
      render: (u) => (
        <button onClick={() => handleToggleActive(u)} className="text-xs font-semibold text-admin-accent hover:underline">
          {u.is_active ? "Deactivate" : "Activate"}
        </button>
      ),
    },
  ];

  return (
    <Panel
      title="Nurses"
      action={
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-admin-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" /> Add Nurse
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <DataTable columns={columns} rows={nurses} keyFor={(u) => u.id} emptyMessage={loading ? "Loading..." : "No nurses yet"} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Nurse">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <Field label="Full name">
            <input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Email">
            <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
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
          <Field label="Ward">
            <input
              required
              value={form.ward}
              onChange={(e) => setForm({ ...form, ward: e.target.value })}
              placeholder="e.g. General Ward A"
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
              {submitting ? "Creating..." : "Create Nurse"}
            </button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}
