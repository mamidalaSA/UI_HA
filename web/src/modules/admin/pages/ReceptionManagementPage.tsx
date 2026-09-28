import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { IconPlus } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { Field, inputClass } from "../components/Field";
import { createUser, listUsers, updateUser, type User } from "../api";

export default function ReceptionManagementPage() {
  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "" });

  function load() {
    setLoading(true);
    listUsers("receptionist")
      .then(setStaff)
      .catch((err) => setError(err?.response?.data?.detail ?? "Failed to load reception staff"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createUser({
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        phone: form.phone || null,
        role: "receptionist",
      });
      setModalOpen(false);
      setForm({ email: "", password: "", full_name: "", phone: "" });
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail ?? "Failed to create reception account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleActive(user: User) {
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      load();
    } catch {
      // no-op
    }
  }

  const columns: Column<User>[] = [
    { header: "Name", render: (u) => <span className="font-medium text-slate-800">{u.full_name}</span> },
    { header: "Email", render: (u) => u.email },
    { header: "Phone", render: (u) => u.phone ?? "—" },
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
      title="Reception Staff"
      action={
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-admin-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" /> Add Reception Staff
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <DataTable columns={columns} rows={staff} keyFor={(u) => u.id} emptyMessage={loading ? "Loading..." : "No reception staff yet"} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Reception Staff">
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
              {submitting ? "Creating..." : "Create Account"}
            </button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}
