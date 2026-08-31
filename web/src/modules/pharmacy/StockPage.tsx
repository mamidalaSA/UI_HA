import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { fetchStock, updateStock, type StockItem, type StockItemUpdate } from "./api";

function expiryTone(expiryDate: string): "red" | "amber" | "slate" {
  const days = (new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "red";
  if (days < 30) return "amber";
  return "slate";
}

interface EditFormState {
  quantity: string;
  min_threshold: string;
  unit_price: string;
  batch_number: string;
  expiry_date: string;
}

function toFormState(item: StockItem): EditFormState {
  return {
    quantity: String(item.quantity),
    min_threshold: String(item.min_threshold),
    unit_price: String(item.unit_price),
    batch_number: item.batch_number,
    expiry_date: item.expiry_date.slice(0, 10),
  };
}

export default function StockPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [form, setForm] = useState<EditFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    try {
      setStock(await fetchStock());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openEdit(item: StockItem) {
    setEditing(item);
    setForm(toFormState(item));
    setFormError("");
  }

  function closeEdit() {
    setEditing(null);
    setForm(null);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editing || !form) return;
    setSaving(true);
    setFormError("");
    try {
      const payload: StockItemUpdate = {
        quantity: Number(form.quantity),
        min_threshold: Number(form.min_threshold),
        unit_price: Number(form.unit_price),
        batch_number: form.batch_number,
        expiry_date: form.expiry_date,
      };
      if (Number.isNaN(payload.quantity) || Number.isNaN(payload.min_threshold) || Number.isNaN(payload.unit_price)) {
        setFormError("Quantity, threshold and price must be numbers.");
        setSaving(false);
        return;
      }
      await updateStock(editing.id, payload);
      closeEdit();
      await load();
    } catch {
      setFormError("Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<StockItem>[] = [
    {
      header: "Medicine",
      render: (row) => <span className="font-semibold text-slate-800">{row.medicine_name}</span>,
    },
    { header: "Batch", render: (row) => row.batch_number },
    {
      header: "Expiry",
      render: (row) => (
        <Badge tone={expiryTone(row.expiry_date)}>{new Date(row.expiry_date).toLocaleDateString()}</Badge>
      ),
    },
    { header: "Quantity", render: (row) => row.quantity },
    { header: "Min threshold", render: (row) => row.min_threshold },
    { header: "Unit price", render: (row) => `₹${Number(row.unit_price).toFixed(2)}` },
    {
      header: "",
      render: (row) => (
        <button
          type="button"
          onClick={() => openEdit(row)}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          Edit
        </button>
      ),
    },
  ];

  return (
    <Panel title="Stock items">
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
      ) : (
        <DataTable columns={columns} rows={stock} keyFor={(row) => row.id} emptyMessage="No stock items yet" />
      )}

      <Modal
        open={editing !== null}
        onClose={closeEdit}
        title={editing ? `Edit ${editing.medicine_name}` : "Edit stock item"}
        footer={
          <>
            <button
              type="button"
              onClick={closeEdit}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="stock-edit-form"
              disabled={saving}
              className="rounded-lg bg-pharmacy-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        {form && (
          <form id="stock-edit-form" onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Quantity</span>
                <input
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pharmacy-accent focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Min threshold</span>
                <input
                  type="number"
                  min={0}
                  value={form.min_threshold}
                  onChange={(e) => setForm({ ...form, min_threshold: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pharmacy-accent focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Unit price</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pharmacy-accent focus:outline-none"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Batch number</span>
                <input
                  type="text"
                  value={form.batch_number}
                  onChange={(e) => setForm({ ...form, batch_number: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pharmacy-accent focus:outline-none"
                />
              </label>
              <label className="col-span-2 block text-sm">
                <span className="mb-1 block font-medium text-slate-600">Expiry date</span>
                <input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pharmacy-accent focus:outline-none"
                />
              </label>
            </div>
            {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}
          </form>
        )}
      </Modal>
    </Panel>
  );
}
