import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/Badge";
import { DataTable, type Column } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { Panel } from "@/components/Panel";
import { IconSearch } from "@/components/icons";
import {
  activatePatient,
  confirmPatient,
  initiatePayment,
  listPatients,
  recordOfflinePayment,
  sendOtp,
  type PatientListItem,
  type ProfileStatus,
} from "./api";
import { PAYMENT_STATUS_TONE, PROFILE_STATUS_TONE, titleCase } from "./statusStyles";
import { ReceptionShell } from "./ReceptionShell";

const STATUS_TABS: { label: string; value: ProfileStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Pending", value: "pending" },
  { label: "Active", value: "active" },
  { label: "Discharged", value: "discharged" },
  { label: "Expired", value: "expired" },
];

export default function PatientListPage() {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ProfileStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [activateTarget, setActivateTarget] = useState<PatientListItem | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);

  const [offlineTarget, setOfflineTarget] = useState<PatientListItem | null>(null);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [offlineBusy, setOfflineBusy] = useState(false);

  const [resendingId, setResendingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const data = await listPatients(tab === "all" ? undefined : tab);
      setPatients(data);
    } catch {
      setActionError("Could not load patients.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => p.full_name.toLowerCase().includes(q) || p.mobile.includes(q));
  }, [patients, search]);

  function openActivate(p: PatientListItem) {
    setActivateTarget(p);
    setOtpCode("");
    setOtpSent(false);
    setActionError(null);
  }

  async function handleSendOtp() {
    if (!activateTarget) return;
    setOtpBusy(true);
    setActionError(null);
    try {
      await sendOtp(activateTarget.mobile, "verify_mobile");
      setOtpSent(true);
    } catch {
      setActionError("Could not send OTP.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleActivateSubmit() {
    if (!activateTarget) return;
    setOtpBusy(true);
    setActionError(null);
    try {
      if (activateTarget.profile_status === "pending") {
        await confirmPatient(activateTarget.id, otpCode);
      } else {
        await activatePatient(activateTarget.id, otpCode);
      }
      setActivateTarget(null);
      await refresh();
    } catch {
      setActionError("Activation failed — check the OTP code and try again.");
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleResend(p: PatientListItem) {
    setResendingId(p.id);
    setActionError(null);
    try {
      await initiatePayment(p.id);
      await refresh();
    } catch {
      setActionError("Could not resend payment link.");
    } finally {
      setResendingId(null);
    }
  }

  function openOffline(p: PatientListItem) {
    setOfflineTarget(p);
    setReceiptNumber("");
    setActionError(null);
  }

  async function handleOfflineSubmit() {
    if (!offlineTarget || !receiptNumber.trim()) return;
    setOfflineBusy(true);
    setActionError(null);
    try {
      await recordOfflinePayment(offlineTarget.id, receiptNumber.trim());
      setOfflineTarget(null);
      await refresh();
    } catch {
      setActionError("Could not record offline payment.");
    } finally {
      setOfflineBusy(false);
    }
  }

  const columns: Column<PatientListItem>[] = [
    { header: "Name", render: (p) => <span className="font-medium text-slate-800">{p.full_name}</span> },
    { header: "Mobile", render: (p) => p.mobile },
    { header: "Channel", render: (p) => titleCase(p.intake_channel) },
    { header: "Status", render: (p) => <Badge tone={PROFILE_STATUS_TONE[p.profile_status]}>{titleCase(p.profile_status)}</Badge> },
    { header: "Payment", render: (p) => <Badge tone={PAYMENT_STATUS_TONE[p.payment_status]}>{titleCase(p.payment_status)}</Badge> },
    { header: "Registered", render: (p) => new Date(p.created_at).toLocaleDateString() },
    {
      header: "Actions",
      render: (p) => (
        <div className="flex flex-wrap gap-2">
          {(p.profile_status === "draft" || p.profile_status === "pending") && (
            <button
              onClick={() => openActivate(p)}
              className="rounded-md bg-reception-accent px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
            >
              Activate
            </button>
          )}
          {(p.payment_status === "link_sent" || p.payment_status === "pending") && (
            <button
              onClick={() => handleResend(p)}
              disabled={resendingId === p.id}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {resendingId === p.id ? "Sending…" : "Resend link"}
            </button>
          )}
          {p.payment_status !== "paid" && p.payment_status !== "waived" && (
            <button
              onClick={() => openOffline(p)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Record offline payment
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <ReceptionShell pageTitle="Patient List">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  tab === t.value ? "bg-reception-accent text-white" : "bg-white text-slate-600 hover:bg-slate-100"
                } border border-slate-200`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2">
            <IconSearch className="h-4 w-4 text-slate-400" />
            <input
              placeholder="Search by name or mobile"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 text-sm outline-none"
            />
          </div>
        </div>

        {actionError && <p className="text-sm font-medium text-red-600">{actionError}</p>}

        <Panel title={`Patients (${filtered.length})`}>
          <DataTable columns={columns} rows={filtered} keyFor={(p) => p.id} emptyMessage={loading ? "Loading…" : "No patients found"} />
        </Panel>
      </div>

      <Modal
        open={activateTarget !== null}
        onClose={() => setActivateTarget(null)}
        title={`Activate ${activateTarget?.full_name ?? ""}`}
        footer={
          <>
            <button onClick={() => setActivateTarget(null)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={handleActivateSubmit}
              disabled={otpBusy || !otpCode}
              className="rounded-md bg-reception-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {otpBusy ? "Working…" : "Confirm activation"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Mobile must be OTP-verified before this profile can be activated. Send an OTP to{" "}
            <span className="font-semibold">{activateTarget?.mobile}</span>, then enter the code below.
          </p>
          <button
            onClick={handleSendOtp}
            disabled={otpBusy}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {otpSent ? "Resend OTP" : "Send OTP"}
          </button>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">OTP Code</label>
            <input
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-reception-accent"
              placeholder="6-digit code"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={offlineTarget !== null}
        onClose={() => setOfflineTarget(null)}
        title={`Record offline payment — ${offlineTarget?.full_name ?? ""}`}
        footer={
          <>
            <button onClick={() => setOfflineTarget(null)} className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={handleOfflineSubmit}
              disabled={offlineBusy || !receiptNumber.trim()}
              className="rounded-md bg-reception-accent px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {offlineBusy ? "Saving…" : "Save"}
            </button>
          </>
        }
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Receipt Number</label>
          <input
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-reception-accent"
            placeholder="e.g. RCPT-00231"
          />
        </div>
      </Modal>
    </ReceptionShell>
  );
}
