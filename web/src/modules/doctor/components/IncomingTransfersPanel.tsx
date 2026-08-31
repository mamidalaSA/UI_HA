import { useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { Badge } from "@/components/Badge";
import { doctorApi } from "../api";
import type { IncomingTransfer } from "../types";

export function IncomingTransfersPanel() {
  const [transfers, setTransfers] = useState<IncomingTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await doctorApi.incomingTransfers();
      setTransfers(data);
      setUnavailable(false);
    } catch {
      // The transfers module is owned by a separate agent — its routes may not be
      // wired up yet in this environment. Degrade quietly instead of crashing.
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function accept(id: string) {
    setBusyId(id);
    try {
      await doctorApi.acceptTransfer(id);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function decline(id: string) {
    const reason = window.prompt("Reason for declining this transfer?");
    if (!reason) return;
    setBusyId(id);
    try {
      await doctorApi.declineTransfer(id, reason);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Panel title="Incoming Transfers">
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : unavailable ? (
        <p className="text-sm text-slate-400">Incoming transfers are not available right now.</p>
      ) : transfers.length === 0 ? (
        <p className="text-sm text-slate-400">No incoming transfer requests.</p>
      ) : (
        <ul className="space-y-3">
          {transfers.map((t) => (
            <li key={t.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {t.patient_name ?? `Patient ${t.patient_id.slice(0, 8)}`}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.transfer_reason}</p>
                </div>
                <Badge tone={t.urgency === "emergency" ? "red" : t.urgency === "urgent" ? "amber" : "slate"}>
                  {t.urgency}
                </Badge>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={busyId === t.id}
                  onClick={() => accept(t.id)}
                  className="rounded-lg bg-doctor-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Accept
                </button>
                <button
                  disabled={busyId === t.id}
                  onClick={() => decline(t.id)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Decline
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
