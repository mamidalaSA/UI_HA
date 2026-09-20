import QRCode from "qrcode";
import { useEffect, useState } from "react";

const UPI_VPA = "cityhospital@upi";
const PAYEE_NAME = "City Hospital Pharmacy";

interface QrPaymentProps {
  amount: number;
  note: string;
}

function buildUpiPayload(amount: number, note: string): string {
  const params = new URLSearchParams({
    pa: UPI_VPA,
    pn: PAYEE_NAME,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note,
  });
  return `upi://pay?${params.toString()}`;
}

/** Renders a scannable UPI QR code for the given amount. Purely a display aid for a
 * mock/demo payment flow — the pharmacist still confirms collection by hand once the
 * patient shows the paid screen (see the reference-number field alongside this). */
export function QrPayment({ amount, note }: QrPaymentProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(buildUpiPayload(amount, note), { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [amount, note]);

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
      {dataUrl ? (
        <img src={dataUrl} alt="UPI payment QR code" className="h-[220px] w-[220px]" />
      ) : (
        <div className="flex h-[220px] w-[220px] items-center justify-center text-xs text-slate-400">Generating QR…</div>
      )}
      <p className="text-center text-xs text-slate-500">
        Scan with any UPI app to pay <span className="font-semibold text-slate-700">₹{amount.toFixed(2)}</span> to {PAYEE_NAME}
      </p>
    </div>
  );
}
