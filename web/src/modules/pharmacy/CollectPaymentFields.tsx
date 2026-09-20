import { useState } from "react";
import { QrPayment } from "./QrPayment";

interface CollectPaymentFieldsProps {
  amount: number;
  note: string;
  receiptNumber: string;
  onReceiptChange: (value: string) => void;
  defaultMethod?: "cash" | "qr";
}

/** Shared body for every "collect a pharmacy bill" modal: pick cash or UPI QR, then
 * record the receipt/reference number either way — that's what the collect-bill
 * endpoint actually stores, since this mock flow has no payment webhook to confirm
 * a QR scan automatically. */
export function CollectPaymentFields({ amount, note, receiptNumber, onReceiptChange, defaultMethod = "cash" }: CollectPaymentFieldsProps) {
  const [method, setMethod] = useState<"cash" | "qr">(defaultMethod);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["cash", "qr"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMethod(option)}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
              method === option
                ? "border-pharmacy-accent bg-pharmacy-accent/10 text-pharmacy-accent"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
          >
            {option === "cash" ? "Cash" : "QR code (UPI)"}
          </button>
        ))}
      </div>

      {method === "qr" && <QrPayment amount={amount} note={note} />}

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {method === "qr" ? "UPI reference number" : "Receipt number"}
        </label>
        <input
          value={receiptNumber}
          onChange={(e) => onReceiptChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pharmacy-accent"
          placeholder={method === "qr" ? "e.g. UPI txn ID after the patient pays" : "e.g. PHR-00231"}
        />
        {method === "qr" && (
          <p className="mt-1 text-xs text-slate-400">Enter the UPI reference once the patient shows a successful payment.</p>
        )}
      </div>
    </div>
  );
}
