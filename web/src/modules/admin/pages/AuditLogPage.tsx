import { useEffect, useState } from "react";
import { DataTable, type Column } from "@/components/DataTable";
import { Panel } from "@/components/Panel";
import { listAuditLog, type AuditLogEntry } from "../api";

const PAGE_SIZE = 25;

export default function AuditLogPage() {
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listAuditLog({
      entity: entityFilter || undefined,
      user_id: userIdFilter || undefined,
      page,
      page_size: PAGE_SIZE,
    })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err?.response?.data?.detail ?? "Failed to load audit log"))
      .finally(() => setLoading(false));
  }, [entityFilter, userIdFilter, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const columns: Column<AuditLogEntry>[] = [
    { header: "Timestamp", render: (r) => new Date(r.created_at).toLocaleString() },
    { header: "Action", render: (r) => <span className="capitalize">{r.action}</span> },
    { header: "Entity", render: (r) => r.entity },
    { header: "Entity ID", render: (r) => <span className="font-mono text-xs">{r.entity_id ?? "—"}</span> },
    { header: "User ID", render: (r) => <span className="font-mono text-xs">{r.user_id ?? "system"}</span> },
    {
      header: "Change",
      render: (r) => (
        <details className="max-w-xs">
          <summary className="cursor-pointer text-xs text-admin-accent">View</summary>
          <pre className="mt-1 max-w-xs overflow-x-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-[11px] text-slate-600">
            {JSON.stringify({ old: r.old_value, new: r.new_value }, null, 2)}
          </pre>
        </details>
      ),
    },
  ];

  return (
    <Panel
      title="Audit Log"
      action={
        <div className="flex gap-2">
          <input
            type="text"
            value={entityFilter}
            onChange={(e) => {
              setPage(1);
              setEntityFilter(e.target.value);
            }}
            placeholder="Filter by entity..."
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-admin-accent"
          />
          <input
            type="text"
            value={userIdFilter}
            onChange={(e) => {
              setPage(1);
              setUserIdFilter(e.target.value);
            }}
            placeholder="Filter by user ID..."
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-admin-accent"
          />
        </div>
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      <DataTable columns={columns} rows={items} keyFor={(r) => r.id} emptyMessage={loading ? "Loading..." : "No audit entries found"} />
      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>
          Page {page} of {totalPages} ({total} entries)
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-slate-200 px-3 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-200 px-3 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </Panel>
  );
}
