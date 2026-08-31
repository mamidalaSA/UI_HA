import { useEffect, useState } from "react";
import { Panel } from "@/components/Panel";
import { getPushOutbox, getSmsOutbox } from "../api";

interface SmsEntry {
  to: string;
  message: string;
}

interface PushEntry {
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/** Thin settings page. Also doubles as the manual-testing window into the mock
 * SMS/push provider outboxes (no real SMS/push account exists in this build). */
export default function SystemSettingsPage() {
  const [sms, setSms] = useState<SmsEntry[]>([]);
  const [push, setPush] = useState<PushEntry[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([getSmsOutbox(), getPushOutbox()])
      .then(([s, p]) => {
        setSms(s);
        setPush(p);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div className="flex flex-col gap-6">
      <Panel title="System Information">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Environment</dt>
            <dd className="font-medium text-slate-800">Development</dd>
          </div>
          <div>
            <dt className="text-slate-500">SMS Provider</dt>
            <dd className="font-medium text-slate-800">Mock (no real account configured)</dd>
          </div>
          <div>
            <dt className="text-slate-500">Push Provider</dt>
            <dd className="font-medium text-slate-800">Mock (no real FCM account configured)</dd>
          </div>
          <div>
            <dt className="text-slate-500">Payment Gateway</dt>
            <dd className="font-medium text-slate-800">Razorpay (webhook signature verified)</dd>
          </div>
        </dl>
      </Panel>

      <Panel
        title="Mock SMS Outbox"
        action={
          <button onClick={load} className="text-xs font-semibold text-admin-accent hover:underline">
            Refresh
          </button>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : sms.length === 0 ? (
          <p className="text-sm text-slate-400">No messages sent yet.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {sms
              .slice()
              .reverse()
              .map((entry, i) => (
                <li key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="font-medium text-slate-700">To: {entry.to}</p>
                  <p className="text-slate-500">{entry.message}</p>
                </li>
              ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Mock Push Outbox"
        action={
          <button onClick={load} className="text-xs font-semibold text-admin-accent hover:underline">
            Refresh
          </button>
        }
      >
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : push.length === 0 ? (
          <p className="text-sm text-slate-400">No notifications sent yet.</p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
            {push
              .slice()
              .reverse()
              .map((entry, i) => (
                <li key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="font-medium text-slate-700">
                    {entry.title} <span className="font-normal text-slate-400">→ user {entry.user_id}</span>
                  </p>
                  <p className="text-slate-500">{entry.body}</p>
                </li>
              ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
