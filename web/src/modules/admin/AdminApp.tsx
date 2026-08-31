import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { AppShell, type NavItem } from "@/components/AppShell";
import {
  IconBed,
  IconBell,
  IconChart,
  IconClipboard,
  IconFile,
  IconFlask,
  IconHeart,
  IconHome,
  IconMapPin,
  IconPill,
  IconSearch,
  IconSettings,
  IconTransfer,
  IconUser,
  IconUsers,
} from "@/components/icons";
import { getPushOutbox } from "./api";
import AlertWindowConfigPage from "./pages/AlertWindowConfigPage";
import AuditLogPage from "./pages/AuditLogPage";
import DashboardPage from "./pages/DashboardPage";
import DepartmentManagementPage from "./pages/DepartmentManagementPage";
import DoctorManagementPage from "./pages/DoctorManagementPage";
import MedicineFormularyPage from "./pages/MedicineFormularyPage";
import NurseManagementPage from "./pages/NurseManagementPage";
import PatientManagementPage from "./pages/PatientManagementPage";
import { SpecialtyMappingWithDepartments } from "./pages/SpecialtyMappingPage";
import SystemSettingsPage from "./pages/SystemSettingsPage";
import TestCataloguePage from "./pages/TestCataloguePage";
import VitalsConfigPage from "./pages/VitalsConfigPage";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: IconHome, end: true },
  { label: "Patient Management", to: "/admin/patients", icon: IconUsers },
  { label: "Doctor Management", to: "/admin/doctors", icon: IconUser },
  { label: "Nurse Management", to: "/admin/nurses", icon: IconHeart },
  { label: "Department Management", to: "/admin/departments", icon: IconMapPin },
  { label: "Test Catalogue", to: "/admin/test-catalogue", icon: IconFlask },
  { label: "Medicine Formulary", to: "/admin/medicine-formulary", icon: IconPill },
  { label: "Vitals Config", to: "/admin/vitals-config", icon: IconChart },
  { label: "Alert Window Config", to: "/admin/alert-window-config", icon: IconBell },
  { label: "Specialty Mapping", to: "/admin/specialty-mapping", icon: IconTransfer },
  { label: "Audit Log", to: "/admin/audit-log", icon: IconFile },
  { label: "System Settings", to: "/admin/settings", icon: IconSettings },
];

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Dashboard",
  "/admin/patients": "Patient Management",
  "/admin/doctors": "Doctor Management",
  "/admin/nurses": "Nurse Management",
  "/admin/departments": "Department Management",
  "/admin/test-catalogue": "Test Catalogue",
  "/admin/medicine-formulary": "Medicine Formulary",
  "/admin/vitals-config": "Vitals Config",
  "/admin/alert-window-config": "Alert Window Config",
  "/admin/specialty-mapping": "Specialty Mapping",
  "/admin/audit-log": "Audit Log",
  "/admin/settings": "System Settings",
};

function AdminLayout() {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] ?? "Admin";
  // "Real count if cheap" per task notes: reuse the mock push-notification outbox
  // as a stand-in for the bell badge count instead of hardcoding 0. Not a true
  // per-admin notification feed (no such endpoint exists in the spec).
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPushOutbox()
      .then((outbox) => {
        if (!cancelled) setNotificationCount(Math.min(outbox.length, 99));
      })
      .catch(() => {
        if (!cancelled) setNotificationCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  return (
    <AppShell
      theme="admin"
      brandTitle="City Hospital"
      brandSubtitle="Management System"
      navSectionLabel="Administration"
      navItems={NAV_ITEMS}
      pageTitle={pageTitle}
      notificationCount={notificationCount}
      headerRight={
        <div className="relative hidden md:block">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          {/* Client-side only — not wired to a search endpoint, per task notes. */}
          <input
            type="text"
            placeholder="Search patients, doctors, records..."
            className="w-64 rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-admin-accent"
          />
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Outlet />
      </div>

      {/* Static "System Status" box, positioned to sit at the bottom of the sidebar
          (matches the reference screenshot). AppShell owns the sidebar markup and
          is off-limits to edit, so this is a fixed overlay sized to the sidebar's
          default expanded width (w-64) rather than an injected child — it lines up
          correctly when the sidebar is expanded (the default state) and is purely
          decorative/static either way. */}
      <div className="pointer-events-none fixed bottom-20 left-4 z-10 w-56 rounded-lg bg-white/10 px-3 py-3">
        <p className="mb-1 text-[11px] font-semibold tracking-wide text-blue-200/70">System Status</p>
        <p className="flex items-center gap-1.5 text-xs font-medium text-white">
          <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
          All Systems Operational
        </p>
      </div>
    </AppShell>
  );
}

export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="patients" element={<PatientManagementPage />} />
        <Route path="doctors" element={<DoctorManagementPage />} />
        <Route path="nurses" element={<NurseManagementPage />} />
        <Route path="departments" element={<DepartmentManagementPage />} />
        <Route path="test-catalogue" element={<TestCataloguePage />} />
        <Route path="medicine-formulary" element={<MedicineFormularyPage />} />
        <Route path="vitals-config" element={<VitalsConfigPage />} />
        <Route path="alert-window-config" element={<AlertWindowConfigPage />} />
        <Route path="specialty-mapping" element={<SpecialtyMappingWithDepartments />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="settings" element={<SystemSettingsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
