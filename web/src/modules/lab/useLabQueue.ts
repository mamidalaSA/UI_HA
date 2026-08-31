import { useCallback, useEffect, useState } from "react";
import { completeTest, fetchQueue, startProgress, type TestQueueItem } from "@/modules/lab/api";

/** Shared queue state + actions used by both the Dashboard and Test Queue pages. */
export function useLabQueue() {
  const [items, setItems] = useState<TestQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<TestQueueItem | null>(null);
  // The /api/lab/queue endpoint only returns pending/in_progress orders (per spec), so it
  // never includes completed ones. We track completions made during this session locally
  // so the "Completed Today" stat card reflects real activity instead of always reading 0.
  const [completedToday, setCompletedToday] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQueue();
      setItems(data);
    } catch {
      setError("Failed to load the test queue. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStart(item: TestQueueItem) {
    setBusyId(item.id);
    try {
      await startProgress(item.id);
      await load();
    } catch {
      setError("Could not start this test. It may have already changed state.");
    } finally {
      setBusyId(null);
    }
  }

  function openComplete(item: TestQueueItem) {
    setModalItem(item);
  }

  function closeComplete() {
    setModalItem(null);
  }

  async function handleComplete(resultText: string, file: File | null) {
    if (!modalItem) return;
    setBusyId(modalItem.id);
    try {
      await completeTest(modalItem.id, resultText, file);
      setModalItem(null);
      setCompletedToday((c) => c + 1);
      await load();
    } catch {
      setError("Could not submit the result. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return {
    items,
    loading,
    error,
    busyId,
    modalItem,
    completedToday,
    reload: load,
    handleStart,
    openComplete,
    closeComplete,
    handleComplete,
  };
}
