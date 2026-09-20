import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { IconSearch } from "@/components/icons";
import { Panel } from "@/components/Panel";
import { StatCard } from "@/components/StatCard";
import {
  listDepartments,
  listPatientBills,
  listPatients,
  type Department,
  type Patient,
  type PatientBill,
  type PaymentStatus,
  type ProfileStatus,
} from "../api";

const STATUS_TONE: Record<ProfileStatus, "green" | "blue" | "amber" | "red" | "slate"> = {
  draft: "slate",
  pending: "amber",
  active: "green",
  discharged: "blue",
  expired: "red",
};

const CONSULT_STATUS_TONE: Record<PaymentStatus, "green" | "amber" | "blue" | "slate"> = {
  paid: "green",
  pending: "amber",
  link_sent: "amber",
  deferred: "amber",
  waived: "blue",
};

interface Row extends Patient {
  bill?: PatientBill;
}

/** Admin's single patient module: profile/status/department (Reception's GET /api/patients)
 * merged with payment history across both billing streams (GET /api/admin/patient-bills) —
 * one place instead of separate "Patient Management" / "Patient Bills" pages. */
export default function PatientManagementPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [bills, setBills] = useState<PatientBill[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([listPatients(), listPatientBills().catch(() => []), listDepartments().catch(() => [])])
      .then(([p, b, d]) => {
        if (cancelled) return;
        setPatients(p);
        setBills(b);
        setDepartments(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.detail ?? "Failed to load patients");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const departmentNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments) map.set(d.id, d.name);
    return map;
  }, [departments]);

  const billByPatientId = useMemo(() => {
    const map = new Map<string, PatientBill>();
    for (const b of bills) map.set(b.patient_id, b);
    return map;
  }, [bills]);

  const rows: Row[] = useMemo(
    () => patients.map((p) => ({ ...p, bill: billByPatientId.get(p.id) })),
    [patients, billByPatientId]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((p) => p.full_name.toLowerCase().includes(q) || p.mobile.includes(q));
  }, [rows, query]);

  const totals = useMemo(
    () =>
      bills.reduce(
        (acc, b) => ({ paid: acc.paid + b.total_paid, pending: acc.pending + b.total_pending }),
        { paid: 0, pending: 0 }
      ),
    [bills]
  );

  const columns: Column<Row>[] = [
    { header: "Name", render: (p) => <span className="font-medium text-slate-800">{p.full_name}</span> },
    { header: "Mobile", render: (p) => p.mobile },
    { header: "Gender", render: (p) => p.gender },
    {
      header: "Department",
      render: (p) => (p.department_id ? departmentNameById.get(p.department_id) ?? "—" : "—"),
    },
    { header: "Admission Type", render: (p) => <span className="capitalize">{p.admission_type}</span> },
    {
      header: "Status",
      render: (p) => <Badge tone={STATUS_TONE[p.profile_status]}>{p.profile_status}</Badge>,
    },
    {
      header: "Admitted",
      render: (p) => (p.admitted_at ? new Date(p.admitted_at).toLocaleDateString() : "—"),
    },
    {
      header: "Consult Fee",
      render: (p) =>
        p.bill ? (
          <div>
            <span>{p.bill.consult_fee !== null ? `₹${p.bill.consult_fee.toFixed(2)}` : "—"}</span>{" "}
            <Badge tone={CONSULT_STATUS_TONE[p.bill.consult_payment_status]}>
              {p.bill.consult_payment_status.replace("_", " ")}
            </Badge>
          </div>
        ) : (
          <span className="capitalize text-slate-400">{p.payment_status.replace("_", " ")}</span>
        ),
    },
    {
      header: "Pharmacy",
      render: (p) => (
        <div className="text-xs">
          <p className="text-emerald-700">Paid ₹{(p.bill?.pharmacy_paid_amount ?? 0).toFixed(2)}</p>
          {(p.bill?.pharmacy_pending_amount ?? 0) > 0 && (
            <p className="text-amber-600">Pending ₹{p.bill!.pharmacy_pending_amount.toFixed(2)}</p>
          )}
          <p className="text-slate-400">{p.bill?.pharmacy_entries ?? 0} item(s)</p>
        </div>
      ),
    },
    {
      header: "Total Paid",
      render: (p) => <span className="font-medium text-emerald-700">₹{(p.bill?.total_paid ?? 0).toFixed(2)}</span>,
    },
    {
      header: "Total Pending",
      render: (p) => {
        const pending = p.bill?.total_pending ?? 0;
        return <span className={`font-medium ${pending > 0 ? "text-amber-600" : "text-slate-400"}`}>₹{pending.toFixed(2)}</span>;
      },
    },
  ];

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard icon={<span className="text-white">₹</span>} iconBg="bg-emerald-500" label="Total Collected" value={`₹${totals.paid.toFixed(2)}`} />
        <StatCard icon={<span className="text-white">₹</span>} iconBg="bg-amber-500" label="Total Outstanding" value={`₹${totals.pending.toFixed(2)}`} />
      </div>

      <Panel
        title={`All Patients (${filtered.length})`}
        action={
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5">
            <IconSearch className="h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or mobile..."
              className="w-48 text-sm outline-none"
            />
          </div>
        }
      >
        <DataTable columns={columns} rows={filtered} keyFor={(p) => p.id} emptyMessage={loading ? "Loading..." : "No patients found"} />
      </Panel>
    </div>
  );
}
