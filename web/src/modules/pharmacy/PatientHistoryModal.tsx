import { useEffect, useState } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { fetchPatientHistory, type BillingPaymentStatus, type PatientMedicineHistoryItem } from "./api";

interface PatientHistoryModalProps {
  patientId: string | null;
  patientName?: string;
  onClose: () => void;
}

const STATUS_TONE: Record<BillingPaymentStatus, "green" | "amber" | "blue"> = {
  paid: "green",
  pending: "amber",
  waived: "blue",
};

export function PatientHistoryModal({ patientId, patientName, onClose }: PatientHistoryModalProps) {
  const [items, setItems] = useState<PatientMedicineHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!patientId) return;
    setLoading(true);
    fetchPatientHistory(patientId)
      .then(setItems)
      .finally(() => setLoading(false));
  }, [patientId]);

  const columns: Column<PatientMedicineHistoryItem>[] = [
    { header: "Medicine", render: (r) => <span className="font-medium text-slate-800">{r.medicine_name}</span> },
    { header: "Qty", render: (r) => r.quantity ?? "—" },
    { header: "Amount", render: (r) => `₹${r.amount.toFixed(2)}` },
    { header: "Dispensed", render: (r) => new Date(r.dispensed_at).toLocaleString() },
    {
      header: "Payment",
      render: (r) => (
        <div>
          <Badge tone={STATUS_TONE[r.payment_status]}>{r.payment_status}</Badge>
          {r.receipt_number && <p className="mt-0.5 text-xs text-slate-400">Receipt {r.receipt_number}</p>}
        </div>
      ),
    },
  ];

  return (
    <Modal open={patientId !== null} onClose={onClose} title={`Medicine history — ${patientName ?? ""}`}>
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
      ) : (
        <DataTable columns={columns} rows={items} keyFor={(r) => r.id} emptyMessage="No medicines dispensed yet" />
      )}
    </Modal>
  );
}
