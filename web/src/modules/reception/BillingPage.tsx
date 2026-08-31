import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import { IconChart } from "@/components/icons";
import { ReceptionShell } from "./ReceptionShell";

// NOTE: There is no billing/invoices table or endpoint in the Module 1 spec beyond
// the payment fields already on `patients` (handled on the Patient List page). This
// page is a static, non-functional demo of what a broader billing view could look
// like; all rows below are hardcoded illustrative data, not live data.
interface InvoiceRow {
  invoiceId: string;
  patient: string;
  amount: string;
  status: "Paid" | "Pending" | "Overdue";
  date: string;
}

const INVOICES: InvoiceRow[] = [
  { invoiceId: "INV-10231", patient: "Ravi Shankar", amount: "₹1,200", status: "Paid", date: "2026-08-12" },
  { invoiceId: "INV-10232", patient: "Meera Nair", amount: "₹850", status: "Pending", date: "2026-08-13" },
  { invoiceId: "INV-10233", patient: "Arjun Rao", amount: "₹2,400", status: "Overdue", date: "2026-08-10" },
  { invoiceId: "INV-10234", patient: "Divya Menon", amount: "₹600", status: "Paid", date: "2026-08-14" },
];

const STATUS_TONE: Record<InvoiceRow["status"], "green" | "amber" | "red"> = {
  Paid: "green",
  Pending: "amber",
  Overdue: "red",
};

export default function BillingPage() {
  const columns: Column<InvoiceRow>[] = [
    { header: "Invoice", render: (r) => <span className="font-medium text-slate-800">{r.invoiceId}</span> },
    { header: "Patient", render: (r) => r.patient },
    { header: "Amount", render: (r) => r.amount },
    { header: "Status", render: (r) => <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge> },
    { header: "Date", render: (r) => r.date },
  ];

  return (
    <ReceptionShell pageTitle="Billing">
      <div className="space-y-6">
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
          Demo data — a dedicated billing/invoices module is outside the current build spec. Live payment status
          per patient is available on the Patient List page.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={<IconChart className="h-6 w-6 text-white" />} iconBg="bg-reception-accent" label="Invoices This Month" value={INVOICES.length} />
          <StatCard icon={<IconChart className="h-6 w-6 text-white" />} iconBg="bg-emerald-500" label="Collected" value="₹2,650" />
          <StatCard icon={<IconChart className="h-6 w-6 text-white" />} iconBg="bg-red-500" label="Outstanding" value="₹2,400" />
        </div>
        <Panel title="Recent Invoices">
          <DataTable columns={columns} rows={INVOICES} keyFor={(r) => r.invoiceId} />
        </Panel>
      </div>
    </ReceptionShell>
  );
}
