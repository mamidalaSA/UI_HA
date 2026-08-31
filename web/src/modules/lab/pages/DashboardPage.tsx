import { useMemo } from "react";
import { StatCard } from "@/components/StatCard";
import { Panel } from "@/components/Panel";
import { IconClipboard, IconFlask, IconChart } from "@/components/icons";
import { QueueTable } from "@/modules/lab/components/QueueTable";
import { CompleteTestModal } from "@/modules/lab/components/CompleteTestModal";
import { useLabQueue } from "@/modules/lab/useLabQueue";

export function DashboardPage() {
  const {
    items,
    loading,
    error,
    busyId,
    modalItem,
    completedToday,
    handleStart,
    openComplete,
    closeComplete,
    handleComplete,
  } = useLabQueue();

  const pendingCount = useMemo(() => items.filter((i) => i.status === "pending").length, [items]);
  const inProgressCount = useMemo(() => items.filter((i) => i.status === "in_progress").length, [items]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<IconClipboard className="h-6 w-6 text-amber-600" />}
          iconBg="bg-amber-100"
          label="Pending"
          value={pendingCount}
        />
        <StatCard
          icon={<IconFlask className="h-6 w-6 text-blue-600" />}
          iconBg="bg-blue-100"
          label="In Progress"
          value={inProgressCount}
        />
        <StatCard
          icon={<IconChart className="h-6 w-6 text-emerald-600" />}
          iconBg="bg-emerald-100"
          label="Completed Today"
          value={completedToday}
        />
      </div>

      <Panel title="Work Queue">
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
