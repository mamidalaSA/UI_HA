import { Route, Routes } from "react-router-dom";
import BedAvailabilityPage from "./BedAvailabilityPage";
import BillingPage from "./BillingPage";
import DashboardPage from "./DashboardPage";
import PatientListPage from "./PatientListPage";
import RegisterPage from "./RegisterPage";

export default function ReceptionApp() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/patients" element={<PatientListPage />} />
      <Route path="/beds" element={<BedAvailabilityPage />} />
      <Route path="/billing" element={<BillingPage />} />
    </Routes>
  );
}
