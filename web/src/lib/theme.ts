import type { Role } from "./roles";

export type ThemeKey = "doctor" | "admin" | "reception" | "nurse" | "lab" | "pharmacy";

export const ROLE_THEME: Record<Role, ThemeKey> = {
  admin: "admin",
  receptionist: "reception",
  doctor: "doctor",
  head_nurse: "nurse",
  lab_staff: "lab",
  pharmacist: "pharmacy",
  patient: "reception",
};

interface ThemeTokens {
  sidebarBg: string;
  sidebarBgActive: string;
  sidebarText: string;
  sidebarTextMuted: string;
  accentText: string;
  accentBg: string;
  accentRing: string;
}

export const THEME_TOKENS: Record<ThemeKey, ThemeTokens> = {
  doctor: {
    sidebarBg: "bg-doctor",
    sidebarBgActive: "bg-doctor-dark",
    sidebarText: "text-white",
    sidebarTextMuted: "text-emerald-200/70",
    accentText: "text-doctor-accent",
    accentBg: "bg-doctor-accent",
    accentRing: "ring-doctor-accent",
  },
  admin: {
    sidebarBg: "bg-admin",
    sidebarBgActive: "bg-admin-accent",
    sidebarText: "text-white",
    sidebarTextMuted: "text-blue-200/70",
    accentText: "text-admin-accent",
    accentBg: "bg-admin-accent",
    accentRing: "ring-admin-accent",
  },
  reception: {
    sidebarBg: "bg-reception",
    sidebarBgActive: "bg-reception-accent",
    sidebarText: "text-white",
    sidebarTextMuted: "text-purple-200/70",
    accentText: "text-reception-accent",
    accentBg: "bg-reception-accent",
    accentRing: "ring-reception-accent",
  },
  nurse: {
    sidebarBg: "bg-nurse",
    sidebarBgActive: "bg-nurse-accent",
    sidebarText: "text-white",
    sidebarTextMuted: "text-sky-200/70",
    accentText: "text-nurse-accent",
    accentBg: "bg-nurse-accent",
    accentRing: "ring-nurse-accent",
  },
  lab: {
    sidebarBg: "bg-lab",
    sidebarBgActive: "bg-lab-accent",
    sidebarText: "text-white",
    sidebarTextMuted: "text-cyan-200/70",
    accentText: "text-lab-accent",
    accentBg: "bg-lab-accent",
    accentRing: "ring-lab-accent",
  },
  pharmacy: {
    sidebarBg: "bg-pharmacy",
    sidebarBgActive: "bg-pharmacy-accent",
    sidebarText: "text-white",
    sidebarTextMuted: "text-indigo-200/70",
    accentText: "text-pharmacy-accent",
    accentBg: "bg-pharmacy-accent",
    accentRing: "ring-pharmacy-accent",
  },
};
