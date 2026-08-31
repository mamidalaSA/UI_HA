import type { PaymentStatus, ProfileStatus } from "./api";

type Tone = "green" | "blue" | "amber" | "red" | "slate" | "purple";

export const PROFILE_STATUS_TONE: Record<ProfileStatus, Tone> = {
  draft: "slate",
  pending: "amber",
  active: "green",
  discharged: "blue",
  expired: "red",
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  pending: "slate",
  link_sent: "amber",
  paid: "green",
  deferred: "purple",
  waived: "blue",
};

export function titleCase(value: string): string {
  return value
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
