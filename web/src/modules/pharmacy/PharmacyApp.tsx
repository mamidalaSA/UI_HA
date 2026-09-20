import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell, type NavItem } from "@/components/AppShell";
import { IconBell, IconChart, IconClipboard, IconHome, IconPill, IconTransfer, IconUsers } from "@/components/icons";
import BillingPage from "./BillingPage";
import DashboardPage from "./DashboardPage";
import LowStockPage from "./LowStockPage";
import PatientsPage from "./PatientsPage";
import QueuePage from "./QueuePage";
import ReturnsPage from "./ReturnsPage";
import StockPage from "./StockPage";

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/pharmacy", icon: IconHome, end: true },
  { label: "Dispense Queue", to: "/pharmacy/queue", icon: IconClipboard },
  { label: "Patients", to: "/pharmacy/patients", icon: IconUsers },
  { label: "Billing", to: "/pharmacy/billing", icon: IconChart },
  { label: "Stock", to: "/pharmacy/stock", icon: IconPill },
  { label: "Low Stock", to: "/pharmacy/stock/low", icon: IconBell },
  { label: "Returns/Wastage", to: "/pharmacy/returns", icon: IconTransfer },
];

export default function PharmacyApp() {
  return (
    <AppShell theme="pharmacy" navSectionLabel="Pharmacy" navItems={NAV_ITEMS} pageTitle="Pharmacy">
      <Routes>
        <Route index element={<DashboardPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="stock/low" element={<LowStockPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="*" element={<Navigate to="/pharmacy" replace />} />
      </Routes>
    </AppShell>
  );
}
