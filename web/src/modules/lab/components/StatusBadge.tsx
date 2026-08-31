import { Badge } from "@/components/Badge";
import type { TestOrderStatus } from "@/modules/lab/api";

const STATUS_TONE: Record<TestOrderStatus, "green" | "blue" | "amber" | "red" | "slate" | "purple"> = {
  pending: "amber",
  in_progress: "blue",
  completed: "green",
  reviewed: "purple",
  cancelled: "red",
};

const STATUS_LABEL: Record<TestOrderStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  reviewed: "Reviewed",
  cancelled: "Cancelled",
};

export function StatusBadge({ status }: { status: TestOrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}
