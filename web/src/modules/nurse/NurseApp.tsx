import { useLocation, Route, Routes } from "react-router-dom";
import { AppShell, type NavItem } from "@/components/AppShell";
import { IconBell, IconCalendar, IconChart, IconClipboard, IconHome, IconUsers } from "@/components/icons";
import DashboardPage from "@/modules/nurse/pages/DashboardPage";
import AlertsPage from "@/modules/nurse/pages/AlertsPage";
import PatientsPage from "@/modules/nurse/pages/PatientsPage";
import SchedulePage from "@/modules/nurse/pages/SchedulePage";
import ObservationPickerPage from "@/modules/nurse/pages/ObservationPickerPage";
import ObservationPage from "@/modules/nurse/pages/ObservationPage";
import ReportsPage from "@/modules/nurse/pages/ReportsPage";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/nurse", icon: IconHome, end: true },
  { label: "My Patients", to: "/nurse/patients", icon: IconUsers },
  { label: "Medication Schedule", to: "/nurse/schedule", icon: IconCalendar },
  { label: "Nurse Observation", to: "/nurse/observation", icon: IconClipboard },
  { label: "Alerts", to: "/nurse/alerts", icon: IconBell },
  { label: "Reports", to: "/nurse/reports", icon: IconChart },
];

function pageTitleFor(pathname: string): string {
  const match = NAV_ITEMS.filter(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`)
  ).sort((a, b) => b.to.length - a.to.length)[0];
  return match?.label ?? "Nurse Panel";
}

export default function NurseApp() {
  const location = useLocation();

  return (
    <AppShell
      theme="nurse"
      navSectionLabel="NURSE PANEL"
      navItems={NAV_ITEMS}
      pageTitle={pageTitleFor(location.pathname)}
    >
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/observation" element={<ObservationPickerPage />} />
        <Route path="/observation/:patientId" element={<ObservationPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
      </Routes>
    </AppShell>
  );
}
