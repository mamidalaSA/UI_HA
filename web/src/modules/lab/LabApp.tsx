import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell, type NavItem } from "@/components/AppShell";
import { IconHome, IconFlask, IconClipboard } from "@/components/icons";
import { DashboardPage } from "@/modules/lab/pages/DashboardPage";
import { QueuePage } from "@/modules/lab/pages/QueuePage";
import { HistoryPage } from "@/modules/lab/pages/HistoryPage";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/lab", icon: IconHome, end: true },
  { label: "Test Queue", to: "/lab/queue", icon: IconFlask },
  { label: "Test History", to: "/lab/history", icon: IconClipboard },
];

const PAGE_TITLES: Record<string, string> = {
  "/lab": "Lab Dashboard",
  "/lab/queue": "Test Queue",
  "/lab/history": "Test History",
};

export default function LabApp() {
  const location = useLocation();
  const pageTitle = PAGE_TITLES[location.pathname] ?? "Lab & Imaging";

  return (
    <AppShell
      theme="lab"
      brandTitle="City Hospital"
      brandSubtitle="Labs & Imaging"
      navSectionLabel="Lab Staff"
      navItems={NAV_ITEMS}
      pageTitle={pageTitle}
    >
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/lab" replace />} />
      </Routes>
    </AppShell>
  );
}
