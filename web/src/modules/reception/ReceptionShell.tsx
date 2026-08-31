import type { ReactNode } from "react";
import { AppShell, type NavItem } from "@/components/AppShell";
import { IconBed, IconChart, IconClipboard, IconHome, IconPlus } from "@/components/icons";

const navItems: NavItem[] = [
  { label: "Dashboard", to: "/reception", icon: IconHome, end: true },
  { label: "Patient Registration", to: "/reception/register", icon: IconPlus },
  { label: "Patient List", to: "/reception/patients", icon: IconClipboard },
  { label: "Bed Availability", to: "/reception/beds", icon: IconBed },
  { label: "Billing", to: "/reception/billing", icon: IconChart },
];

export function ReceptionShell({ pageTitle, headerRight, children }: { pageTitle: string; headerRight?: ReactNode; children: ReactNode }) {
  return (
    <AppShell
      theme="reception"
      brandTitle="City Hospital"
      brandSubtitle="Care with Compassion"
      navSectionLabel="Reception"
      navItems={navItems}
      pageTitle={pageTitle}
      headerRight={headerRight}
    >
      {children}
    </AppShell>
  );
}
