import type { AlertStatus } from "@/modules/nurse/api";

export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export const STATUS_TONE: Record<AlertStatus, "green" | "blue" | "amber" | "red" | "slate" | "purple"> = {
  SCHEDULED: "slate",
  FIRED: "amber",
  ACKNOWLEDGED: "blue",
  GIVEN: "green",
  MISSED: "red",
  CANCELLED: "slate",
};
