import { Panel } from "@/components/Panel";
import { QueueTable } from "@/modules/lab/components/QueueTable";
import { CompleteTestModal } from "@/modules/lab/components/CompleteTestModal";
import { useLabQueue } from "@/modules/lab/useLabQueue";

export function QueuePage() {
  const { items, loading, error, busyId, modalItem, handleStart, openComplete, closeComplete, handleComplete, reload } =
    useLabQueue();

  return (
    <div className="space-y-6">
      <Panel
        title="Test Queue"
        action={
          <button
            onClick={reload}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </button>
        }
      >
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">Loading queue…</p>
        ) : (
          <QueueTable items={items} busyId={busyId} onStart={handleStart} onComplete={openComplete} />
        )}
      </Panel>

      <CompleteTestModal item={modalItem} submitting={busyId === modalItem?.id} onClose={closeComplete} onSubmit={handleComplete} />
    </div>
  );
}
