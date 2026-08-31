import axios from "axios";
import { useEffect, useState, type FormEvent } from "react";
import { Panel } from "@/components/Panel";
import { fetchStock, postReturn, type ReturnKind, type StockItem } from "./api";

export default function ReturnsPage() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [stockItemId, setStockItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [kind, setKind] = useState<ReturnKind>("return");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const rows = await fetchStock();
      setStock(rows);
      if (rows.length > 0) setStockItemId(rows[0].id);
    })();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    const qty = Number(quantity);
    if (!stockItemId) {
      setMessage({ tone: "error", text: "Choose a stock item." });
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage({ tone: "error", text: "Quantity must be a positive number." });
      return;
    }
    setSubmitting(true);
    try {
      await postReturn({ stock_item_id: stockItemId, quantity: qty, kind, notes: notes || null });
      setMessage({ tone: "success", text: kind === "return" ? "Return logged and stock updated." : "Wastage logged." });
      setQuantity("1");
      setNotes("");
    } catch (err) {
      let text = "Could not log this entry. Please try again.";
      if (axios.isAxiosError<{ detail?: string }>(err) && typeof err.response?.data?.detail === "string") {
        text = err.response.data.detail;
      }
      setMessage({ tone: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel title="Log a return or wastage" className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Stock item</span>
          <select
            value={stockItemId}
            onChange={(e) => setStockItemId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pharmacy-accent focus:outline-none"
          >
            {stock.length === 0 && <option value="">No stock items available</option>}
            {stock.map((item) => (
              <option key={item.id} value={item.id}>
                {item.medicine_name} — batch {item.batch_number} ({item.quantity} in stock)
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Quantity</span>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pharmacy-accent focus:outline-none"
          />
        </label>

        <div className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Type</span>
          <div className="flex gap-2">
            {(["return", "wastage"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setKind(option)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold capitalize transition ${
                  kind === option
                    ? "border-pharmacy-accent bg-pharmacy-accent/10 text-pharmacy-accent"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {kind === "return"
              ? "Increases the stock item's quantity back up."
              : "Log only — quantity already deducted/lost, no stock change."}
          </p>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-pharmacy-accent focus:outline-none"
            placeholder="Reason for return or wastage…"
          />
        </label>

        {message && (
          <p className={`text-sm font-medium ${message.tone === "success" ? "text-emerald-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || stock.length === 0}
          className="rounded-lg bg-pharmacy-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Log entry"}
        </button>
      </form>
    </Panel>
  );
}
