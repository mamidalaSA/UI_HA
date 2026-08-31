import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { dispenseRx, fetchQueue, type DispenseConflict, type QueueItem } from "./api";
import { QueueTable } from "./QueueTable";

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispensingId, setDispensingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  async function handleDispense(item: QueueItem) {
    setDispensingId(item.id);
    setErrors((prev) => ({ ...prev, [item.id]: "" }));
    try {
      await dispenseRx(item.id);
      await load();
    } catch (err) {
      let message = "Dispense failed. Please try again.";
      if (axios.isAxiosError<{ detail?: DispenseConflict | string }>(err)) {
        const detail = err.response?.data?.detail;
        if (detail && typeof detail === "object" && Array.isArray(detail.shortages)) {
          const shortages = detail.shortages
            .map((s) => `${s.medicine_name} (need ${s.required_quantity}, have ${s.available_quantity})`)
            .join(", ");
          message = `Out of stock — ${shortages}`;
        } else if (typeof detail === "string") {
          message = detail;
        }
      }
      setErrors((prev) => ({ ...prev, [item.id]: message }));
      await load();
    } finally {
      setDispensingId(null);
    }
  }

  return (
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
        <QueueTable items={queue} dispensingId={dispensingId} errors={errors} onDispense={handleDispense} />
      )}
    </Panel>
  );
}
