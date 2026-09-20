import { useCallback, useEffect, useState } from "react";
import { IconBell, IconClipboard, IconPill } from "@/components/icons";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { fetchLowStock, fetchQueue, type QueueItem } from "./api";
import { DispenseModal } from "./DispenseModal";
import { PatientHistoryModal } from "./PatientHistoryModal";
import { QueueTable } from "./QueueTable";

// There is no backend endpoint that returns dispense history (only a single DispenseLog is
// returned per action), so "Dispensed today" cannot be computed from a server query. Per the
// task's "derive client-side" instruction, we track it as a same-day running counter in
// localStorage, bumped each time a dispense succeeds from this browser. It resets at midnight
// and does not reflect dispenses made from another device/session.
const TODAY_COUNT_KEY = "pharmacy_dispensed_today";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readDispensedToday(): number {
  try {
    const raw = localStorage.getItem(TODAY_COUNT_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { date: string; count: number };
    return parsed.date === todayKey() ? parsed.count : 0;
  } catch {
    return 0;
  }
}

function bumpDispensedToday(): number {
  const next = readDispensedToday() + 1;
  localStorage.setItem(TODAY_COUNT_KEY, JSON.stringify({ date: todayKey(), count: next }));
  return next;
}

export default function DashboardPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [dispensedToday, setDispensedToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [historyTarget, setHistoryTarget] = useState<QueueItem | null>(null);
  const [dispenseTarget, setDispenseTarget] = useState<QueueItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [queueRows, lowStockRows] = await Promise.all([fetchQueue(), fetchLowStock()]);
      setQueue(queueRows);
      setLowStockCount(lowStockRows.length);
      setDispensedToday(readDispensedToday());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<IconClipboard className="h-6 w-6 text-pharmacy-accent" />}
          iconBg="bg-pharmacy-accent/10"
          label="Pending in queue"
          value={queue.length}
          linkTo="/pharmacy/queue"
        />
        <StatCard
          icon={<IconBell className="h-6 w-6 text-amber-600" />}
          iconBg="bg-amber-100"
          label="Low stock items"
          value={lowStockCount}
          linkTo="/pharmacy/stock/low"
        />
        <StatCard
          icon={<IconPill className="h-6 w-6 text-emerald-600" />}
          iconBg="bg-emerald-100"
          label="Dispensed today"
          value={dispensedToday}
        />
      </div>

      <Panel title="Dispense queue" action={<span className="text-xs text-slate-400">Sorted by admission time</span>}>
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
        ) : (
          <QueueTable items={queue} onDispense={setDispenseTarget} onViewHistory={setHistoryTarget} />
        )}
      </Panel>
      <DispenseModal
        item={dispenseTarget}
        onClose={() => setDispenseTarget(null)}
        onDispensed={() => {
          setDispensedToday(bumpDispensedToday());
          void load();
        }}
      />
      <PatientHistoryModal
        patientId={historyTarget?.patient_id ?? null}
        patientName={historyTarget?.patient_name}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
