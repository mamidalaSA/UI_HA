import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { fetchQueue, type QueueItem } from "./api";
import { DispenseModal } from "./DispenseModal";
import { PatientHistoryModal } from "./PatientHistoryModal";
import { QueueTable } from "./QueueTable";

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyTarget, setHistoryTarget] = useState<QueueItem | null>(null);
  const [dispenseTarget, setDispenseTarget] = useState<QueueItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setQueue(await fetchQueue());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <Panel
        title="Dispense queue"
        action={
          <button
            type="button"
            onClick={() => void load()}
            className="text-xs font-semibold text-pharmacy-accent hover:underline"
          >
            Refresh
          </button>
        }
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
        ) : (
          <QueueTable items={queue} onDispense={setDispenseTarget} onViewHistory={setHistoryTarget} />
        )}
      </Panel>
      <DispenseModal item={dispenseTarget} onClose={() => setDispenseTarget(null)} onDispensed={() => void load()} />
      <PatientHistoryModal
        patientId={historyTarget?.patient_id ?? null}
        patientName={historyTarget?.patient_name}
        onClose={() => setHistoryTarget(null)}
      />
    </>
  );
}
