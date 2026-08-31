import type { ProfileStatus, TestOrderStatus } from "./types";

type Tone = "green" | "blue" | "amber" | "red" | "slate" | "purple";

export function calcAge(dob: string): number {
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function statusTone(status: ProfileStatus): Tone {
  switch (status) {
    case "active":
      return "green";
    case "pending":
      return "amber";
    case "draft":
      return "slate";
    case "discharged":
      return "blue";
    case "expired":
      return "red";
    default:
      return "slate";
  }
}

export function testStatusTone(status: TestOrderStatus): Tone {
  switch (status) {
    case "pending":
      return "amber";
    case "in_progress":
      return "blue";
    case "completed":
      return "purple";
    case "reviewed":
      return "green";
    case "cancelled":
      return "red";
    default:
      return "slate";
  }
}
