import axios from "axios";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { collectBill, dispenseRx, type DispenseConflict, type DispenseResponse, type QueueItem } from "./api";
import { CollectPaymentFields } from "./CollectPaymentFields";

interface DispenseModalProps {
  item: QueueItem | null;
  onClose: () => void;
  onDispensed: (item: QueueItem, result: DispenseResponse) => void;
}

type Method = "cash" | "qr" | "later";

export function DispenseModal({ item, onClose, onDispensed }: DispenseModalProps) {
  const [method, setMethod] = useState<Method>("cash");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set once the dispense itself has gone through (any method) — while this is non-null
  // we're in the "collect payment" step, shown when the pharmacist chose QR (the exact
  // amount is only known after stock is matched, so a QR can't be shown beforehand).
  const [dispensedResult, setDispensedResult] = useState<DispenseResponse | null>(null);
  const [collectBusy, setCollectBusy] = useState(false);
  const [collectError, setCollectError] = useState<string | null>(null);

  function reset() {
    setMethod("cash");
    setReceiptNumber("");
    setError(null);
    setDispensedResult(null);
    setCollectError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleDispenseSubmit() {
    if (!item) return;
    if (method === "cash" && !receiptNumber.trim()) {
      setError("Enter a receipt number, or choose QR code / bill later.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await dispenseRx(item.id, method === "cash" ? receiptNumber.trim() : undefined);
      if (method === "qr") {
        setDispensedResult(result);
      } else {
        reset();
        onDispensed(item, result);
      }
    } catch (err) {
      let message = "Dispense failed. Please try again.";
      if (axios.isAxiosError<{ detail?: DispenseConflict | string }>(err)) {
        const detail = err.response?.data?.detail;
        if (detail && typeof detail === "object" && Array.isArray(detail.shortages)) {
          const shortages = detail.shortages
            .map((s) => `${s.medicine_name} (need ${s.required_quantity}, have ${s.available_quantity})`)
            .join(", ");
          message = `Out of stock — ${shortages}`;
        } else if (typeof detail === "string") {
          message = detail;
        }
      }
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCollectSubmit() {
    if (!item || !dispensedResult || !receiptNumber.trim()) return;
    setCollectBusy(true);
    setCollectError(null);
    try {
      await collectBill(item.patient_id, receiptNumber.trim());
      const result = dispensedResult;
      reset();
      onDispensed(item, result);
    } catch (err) {
      let text = "Could not record this payment. Please try again.";
      if (axios.isAxiosError<{ detail?: string }>(err) && typeof err.response?.data?.detail === "string") {
        text = err.response.data.detail;
      }
      setCollectError(text);
    } finally {
      setCollectBusy(false);
    }
  }

  if (dispensedResult) {
    return (
      <Modal
        open={item !== null}
        onClose={handleClose}
        title={`Collect payment — ${item?.patient_name ?? ""}`}
        footer={
          <>
            <button onClick={handleClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Bill later
            </button>
            <button
              onClick={handleCollectSubmit}
              disabled={collectBusy || !receiptNumber.trim()}
              className="rounded-md bg-pharmacy-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {collectBusy ? "Saving…" : "Mark as paid"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm font-medium text-emerald-600">Dispensed — total ₹{dispensedResult.total_amount.toFixed(2)}</p>
          <CollectPaymentFields
            amount={dispensedResult.total_amount}
            note={`Pharmacy bill — ${item?.patient_name ?? ""}`}
            receiptNumber={receiptNumber}
            onReceiptChange={setReceiptNumber}
            defaultMethod="qr"
          />
          {collectError && <p className="text-sm font-medium text-red-600">{collectError}</p>}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={item !== null}
      onClose={handleClose}
      title={`Dispense — ${item?.patient_name ?? ""}`}
      footer={
        <>
          <button onClick={handleClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleDispenseSubmit}
            disabled={busy}
            className="rounded-md bg-pharmacy-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Dispensing…" : "Dispense"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <ul className="space-y-0.5 rounded-lg bg-slate-50 px-3 py-2">
          {item?.lines.map((line) => (
            <li key={line.id} className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{line.medicine_name}</span> · {line.dosage} ·{" "}
              {line.frequency.replace(/_/g, " ")}
            </li>
          ))}
        </ul>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Payment</label>
          <div className="flex gap-2">
            {([
              { key: "cash", label: "Cash" },
              { key: "qr", label: "QR code (UPI)" },
              { key: "later", label: "Bill later" },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setMethod(option.key)}
                className={`flex-1 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                  method === option.key
                    ? "border-pharmacy-accent bg-pharmacy-accent/10 text-pharmacy-accent"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {method === "cash" && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Receipt Number</label>
            <input
              value={receiptNumber}
              onChange={(e) => setReceiptNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pharmacy-accent"
              placeholder="e.g. PHR-00231"
            />
          </div>
        )}
        {method === "qr" && (
          <p className="text-xs text-slate-500">
            The bill is dispensed first, then a QR code for the confirmed amount is shown to collect payment.
          </p>
        )}
        {method === "later" && (
          <p className="text-xs text-amber-600">The bill will be created as pending — collect it later from Billing or Patients.</p>
        )}

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
