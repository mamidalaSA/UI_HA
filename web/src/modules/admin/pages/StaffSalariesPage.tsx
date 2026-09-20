import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { listSalaries, paySalary, upsertSalary, type StaffSalaryRow } from "../api";

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface Group {
  key: string;
  title: string;
  match: (row: StaffSalaryRow) => boolean;
}

const GROUPS: Group[] = [
  { key: "doctors", title: "Doctors", match: (r) => r.role === "doctor" },
  { key: "nurses", title: "Nurses", match: (r) => r.role === "head_nurse" },
  {
    key: "other",
    title: "Other Staff",
    match: (r) => r.role !== "doctor" && r.role !== "head_nurse" && r.role !== "patient",
  },
];

export default function StaffSalariesPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [rows, setRows] = useState<StaffSalaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editTarget, setEditTarget] = useState<StaffSalaryRow | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listSalaries(period));
    } catch (err) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Failed to load salaries");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(
    () => GROUPS.map((g) => ({ ...g, rows: rows.filter(g.match) })),
    [rows]
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => {
          if (r.status === "paid") acc.paid += r.amount ?? 0;
          else if (r.status === "pending") acc.pending += r.amount ?? 0;
          return acc;
        },
        { paid: 0, pending: 0 }
      ),
    [rows]
  );

  function openEdit(row: StaffSalaryRow) {
    setEditTarget(row);
    setAmountInput(row.amount !== null ? String(row.amount) : "");
    setNotesInput(row.notes ?? "");
  }

  async function handleSaveAmount() {
    if (!editTarget) return;
    const amount = Number(amountInput);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setSaving(true);
    try {
      await upsertSalary({ user_id: editTarget.user_id, period, amount, notes: notesInput || null });
      setEditTarget(null);
      await load();
    } catch (err) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not save salary");
    } finally {
      setSaving(false);
    }
  }

  async function handlePay(row: StaffSalaryRow) {
    if (!row.salary_id) return;
    setPayingId(row.salary_id);
    try {
      await paySalary(row.salary_id);
      await load();
    } catch (err) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Could not mark salary as paid");
    } finally {
      setPayingId(null);
    }
  }

  function columnsFor(): Column<StaffSalaryRow>[] {
    return [
      { header: "Name", render: (r) => <span className="font-medium text-slate-800">{r.full_name}</span> },
      { header: "Email", render: (r) => r.email },
      { header: "Amount", render: (r) => (r.amount !== null ? `₹${r.amount.toFixed(2)}` : <span className="text-slate-400">Not set</span>) },
      {
        header: "Status",
        render: (r) =>
          r.status === "paid" ? (
            <Badge tone="green">Paid</Badge>
          ) : r.status === "pending" ? (
            <Badge tone="amber">Pending</Badge>
          ) : (
            <Badge tone="slate">Not set</Badge>
          ),
      },
      {
        header: "Actions",
        render: (r) => (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openEdit(r)}
              disabled={r.status === "paid"}
              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {r.amount !== null ? "Update" : "Set salary"}
            </button>
            {r.status === "pending" && (
              <button
                type="button"
                onClick={() => void handlePay(r)}
                disabled={payingId === r.salary_id}
                className="rounded-lg bg-admin-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {payingId === r.salary_id ? "Paying…" : "Mark paid"}
              </button>
            )}
          </div>
        ),
      },
    ];
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Paid this period</p>
            <p className="text-xl font-bold text-emerald-700">₹{totals.paid.toFixed(2)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-medium text-slate-500">Pending this period</p>
            <p className="text-xl font-bold text-amber-600">₹{totals.pending.toFixed(2)}</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Period
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-admin-accent"
          />
        </label>
      </div>

      {error && <p className="text-sm font-medium text-red-600">{error}</p>}

      {grouped.map((g) => (
        <Panel key={g.key} title={`${g.title} (${g.rows.length})`}>
          <DataTable columns={columnsFor()} rows={g.rows} keyFor={(r) => r.user_id} emptyMessage={loading ? "Loading…" : "No staff in this group"} />
        </Panel>
      ))}

      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={`Set salary — ${editTarget?.full_name ?? ""} (${period})`}
        footer={
          <>
            <button onClick={() => setEditTarget(null)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={handleSaveAmount}
              disabled={saving || !amountInput}
              className="rounded-md bg-admin-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Amount (₹)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-admin-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Notes</label>
            <input
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-admin-accent"
              placeholder="optional"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
