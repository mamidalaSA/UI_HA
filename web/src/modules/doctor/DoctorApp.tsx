import { Route, Routes } from "react-router-dom";
import { AppShell, type NavItem } from "@/components/AppShell";
import { IconChart, IconClipboard, IconFlask, IconHome, IconPill, IconUsers } from "@/components/icons";
import DashboardPage from "./pages/DashboardPage";
import PatientsListPage from "./pages/PatientsListPage";
import PatientDetailPage from "./pages/PatientDetailPage";
import PrescriptionsPage from "./pages/PrescriptionsPage";
import TestsPage from "./pages/TestsPage";
import ReportsPage from "./pages/ReportsPage";
import ConsultationsPage from "./pages/ConsultationsPage";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/doctor", icon: IconHome, end: true },
  { label: "My Patients", to: "/doctor/patients", icon: IconUsers },
  { label: "Prescriptions", to: "/doctor/prescriptions", icon: IconPill },
  { label: "Tests & Scans", to: "/doctor/tests", icon: IconFlask },
  { label: "Reports", to: "/doctor/reports", icon: IconChart },
  { label: "Consultations", to: "/doctor/consultations", icon: IconClipboard },
];

export default function DoctorApp() {
  return (
    <AppShell
      theme="doctor"
      brandTitle="City Hospital"
      brandSubtitle="Care with Compassion"
      navItems={NAV_ITEMS}
      pageTitle="Doctor Dashboard"
    >
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="patients" element={<PatientsListPage />} />
        <Route path="patients/:id" element={<PatientDetailPage />} />
        <Route path="prescriptions" element={<PrescriptionsPage />} />
        <Route path="tests" element={<TestsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="consultations" element={<ConsultationsPage />} />
        <Route path="*" element={<DashboardPage />} />
      </Routes>
    </AppShell>
  );
}
