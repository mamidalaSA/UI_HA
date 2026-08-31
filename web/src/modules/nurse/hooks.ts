import { useCallback, useEffect, useState } from "react";
import {
  acknowledgeAlert,
  fetchNurseAlerts,
  logDose,
  type MedicationLogCreatePayload,
  type NurseAlert,
} from "@/modules/nurse/api";

/** Shared data/actions for the ward's active dose alerts (GET /api/nurse/alerts).
 * Used by the Dashboard, Alerts, and Medication Schedule pages so they all stay in
 * sync off one fetch/refresh cycle instead of duplicating the request logic. */
export function useNurseAlerts() {
  const [alerts, setAlerts] = useState<NurseAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ackingId, setAckingId] = useState<string | null>(null);
  const [loggingId, setLoggingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchNurseAlerts();
      setAlerts(data);
    } catch {
      setError("Could not load alerts. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function acknowledge(alertId: string) {
    setAckingId(alertId);
    try {
      await acknowledgeAlert(alertId);
      await refresh();
    } finally {
      setAckingId(null);
    }
  }

  async function submitLog(alertId: string, payload: MedicationLogCreatePayload) {
    setLoggingId(alertId);
    try {
      await logDose(alertId, payload);
      await refresh();
    } finally {
      setLoggingId(null);
    }
  }

  return { alerts, loading, error, refresh, acknowledge, ackingId, submitLog, loggingId };
}
