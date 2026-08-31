import { useEffect, useState, type FormEvent } from "react";
import { Panel } from "@/components/Panel";
import { Field, inputClass } from "../components/Field";
import { getAlertWindowConfig, upsertAlertWindowConfig } from "../api";

export default function AlertWindowConfigPage() {
  const [fireBefore, setFireBefore] = useState("15");
  const [expireAfter, setExpireAfter] = useState("30");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getAlertWindowConfig()
      .then((cfg) => {
        if (cfg) {
          setFireBefore(String(cfg.fire_before_minutes));
          setExpireAfter(String(cfg.expire_after_minutes));
        }
      })
      .catch((err) => setError(err?.response?.data?.detail ?? "Failed to load alert window config"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fb = Number(fireBefore);
    const ea = Number(expireAfter);
    if (Number.isNaN(fb) || Number.isNaN(ea) || fb < 0 || ea < 0) {
      setError("Both values must be non-negative numbers");
      return;
    }
    setSaving(true);
    try {
      await upsertAlertWindowConfig({ fire_before_minutes: fb, expire_after_minutes: ea });
      setSaved(true);
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to save alert window config");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Alert Window Config">
      <p className="mb-4 text-sm text-slate-500">
        Controls how many minutes before a scheduled dose the in-app alert fires, and how many minutes after it
        expires (i.e. is marked MISSED). There is only one active configuration for the whole system.
      </p>
      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-3">
          <Field label="Fire before (minutes)">
            <input
              type="number"
              min={0}
              value={fireBefore}
              onChange={(e) => setFireBefore(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Expire after (minutes)">
            <input
              type="number"
              min={0}
              value={expireAfter}
              onChange={(e) => setExpireAfter(e.target.value)}
              className={inputClass}
            />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Saved.</p>}
          <div className="mt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-admin-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </form>
      )}
    </Panel>
  );
}
