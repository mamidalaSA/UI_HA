import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { IconPlus } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { Field, inputClass } from "../components/Field";
import {
  createMedicineFormularyEntry,
  listMedicineFormulary,
  updateMedicineFormularyEntry,
  type MedicineFormularyEntry,
} from "../api";

const EMPTY_FORM = { name: "", default_dosage: "", is_approved: true };

export default function MedicineFormularyPage() {
  const [entries, setEntries] = useState<MedicineFormularyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MedicineFormularyEntry | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  function load() {
    setLoading(true);
    listMedicineFormulary()
      .then(setEntries)
      .catch((err) => setError(err?.response?.data?.detail ?? "Failed to load medicine formulary"))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(entry: MedicineFormularyEntry) {
    setEditing(entry);
    setForm({ name: entry.name, default_dosage: entry.default_dosage ?? "", is_approved: entry.is_approved });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = { name: form.name, default_dosage: form.default_dosage || null, is_approved: form.is_approved };
      if (editing) {
        await updateMedicineFormularyEntry(editing.id, payload);
      } else {
        await createMedicineFormularyEntry(payload);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      setFormError(err?.response?.data?.detail ?? "Failed to save medicine");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleApproved(entry: MedicineFormularyEntry) {
    try {
      await updateMedicineFormularyEntry(entry.id, { is_approved: !entry.is_approved });
      load();
    } catch {
      // no-op
    }
  }

  const columns: Column<MedicineFormularyEntry>[] = [
    { header: "Medicine", render: (m) => <span className="font-medium text-slate-800">{m.name}</span> },
    { header: "Default Dosage", render: (m) => m.default_dosage ?? "—" },
    {
      header: "Status",
      render: (m) => <Badge tone={m.is_approved ? "green" : "slate"}>{m.is_approved ? "Approved" : "Unapproved"}</Badge>,
    },
    {
      header: "Actions",
      render: (m) => (
        <div className="flex gap-3">
          <button onClick={() => openEdit(m)} className="text-xs font-semibold text-admin-accent hover:underline">
            Edit
          </button>
          <button onClick={() => toggleApproved(m)} className="text-xs font-semibold text-slate-500 hover:underline">
            {m.is_approved ? "Unapprove" : "Approve"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <Panel
      title="Medicine Formulary"
      action={
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-admin-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <IconPlus className="h-4 w-4" /> Add Medicine
        </button>
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <DataTable columns={columns} rows={entries} keyFor={(m) => m.id} emptyMessage={loading ? "Loading..." : "No medicines configured"} />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Edit Medicine" : "Add Medicine"}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Medicine name">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Default dosage">
            <input
              value={form.default_dosage}
              onChange={(e) => setForm({ ...form, default_dosage: e.target.value })}
              placeholder="e.g. 500mg"
              className={inputClass}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_approved}
              onChange={(e) => setForm({ ...form, is_approved: e.target.checked })}
            />
            <span className="font-medium text-slate-600">Approved for prescribing</span>
          </label>
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
              {submitting ? "Saving..." : editing ? "Save Changes" : "Add Medicine"}
            </button>
          </div>
        </form>
      </Modal>
    </Panel>
  );
}
