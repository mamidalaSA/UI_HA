import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Panel } from "@/components/Panel";
import type {
  AdmissionType,
  Gender,
  IntakeChannel,
  PatientCreatePayload,
} from "./api";
import { createPatient } from "./api";
import { ReceptionShell } from "./ReceptionShell";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-reception-accent";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

interface FormState {
  full_name: string;
  date_of_birth: string;
  gender: Gender | "";
  blood_group: string;
  mobile: string;
  email: string;
  id_number: string;
  address: string;
  emergency_name: string;
  emergency_phone: string;
  intake_channel: IntakeChannel;
  admission_type: AdmissionType | "";
  chief_complaint: string;
  medico_legal: boolean;
  fir_number: string;
  defer_payment: boolean;
}

const initialState: FormState = {
  full_name: "",
  date_of_birth: "",
  gender: "",
  blood_group: "",
  mobile: "",
  email: "",
  id_number: "",
  address: "",
  emergency_name: "",
  emergency_phone: "",
  intake_channel: "phone",
  admission_type: "",
  chief_complaint: "",
  medico_legal: false,
  fir_number: "",
  defer_payment: false,
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialState);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessLink(null);

    if (!form.gender || !form.admission_type) {
      setError("Please fill in all required fields.");
      return;
    }
    if (form.medico_legal && !form.fir_number.trim()) {
      setError("FIR number is required when Medico-Legal is toggled on.");
      return;
    }

    const payload: PatientCreatePayload = {
      full_name: form.full_name,
      date_of_birth: form.date_of_birth,
      gender: form.gender,
      id_number: form.id_number,
      blood_group: form.blood_group || null,
      mobile: form.mobile,
      email: form.email || null,
      address: form.address || null,
      emergency_name: form.emergency_name,
      emergency_phone: form.emergency_phone,
      intake_channel: form.intake_channel,
      admission_type: form.admission_type,
      chief_complaint: form.chief_complaint,
      medico_legal: form.medico_legal,
      fir_number: form.medico_legal ? form.fir_number : null,
      defer_payment: form.intake_channel === "emergency" ? form.defer_payment : undefined,
    };

    setSubmitting(true);
    try {
      const patient = await createPatient(payload);
      if (patient.payment_link) {
        setSuccessLink(patient.payment_link);
      }
      setForm(initialState);
      if (!patient.payment_link) {
        navigate("/reception/patients");
      }
    } catch {
      setError("Could not register patient. Please check the form and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ReceptionShell pageTitle="Patient Registration">
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Personal Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Full Name *</label>
                <input required className={inputClass} value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Date of Birth *</label>
                <input required type="date" className={inputClass} value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Gender *</label>
                <select required className={inputClass} value={form.gender} onChange={(e) => set("gender", e.target.value as Gender)}>
                  <option value="">Select gender</option>
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Blood Group</label>
                <input className={inputClass} placeholder="e.g. O+" value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Mobile *</label>
                <input required className={inputClass} value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" className={inputClass} value={form.email} onChange={(e) => set("email", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>ID Number / Aadhaar *</label>
                <input required className={inputClass} value={form.id_number} onChange={(e) => set("id_number", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Address</label>
                <textarea className={inputClass} rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Emergency Contact Name *</label>
                <input required className={inputClass} value={form.emergency_name} onChange={(e) => set("emergency_name", e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Emergency Contact Number *</label>
                <input required className={inputClass} value={form.emergency_phone} onChange={(e) => set("emergency_phone", e.target.value)} />
              </div>
            </div>
          </Panel>

          <Panel title="Visit Details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Intake Channel *</label>
                <select
                  required
                  className={inputClass}
                  value={form.intake_channel}
                  onChange={(e) => set("intake_channel", e.target.value as IntakeChannel)}
                >
                  <option value="emergency">Emergency walk-in</option>
                  <option value="phone">Phone appointment</option>
                  <option value="website">Website booking</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Admission Type *</label>
                <select
                  required
                  className={inputClass}
                  value={form.admission_type}
                  onChange={(e) => set("admission_type", e.target.value as AdmissionType)}
                >
                  <option value="">Select type</option>
                  <option value="inpatient">Inpatient</option>
                  <option value="outpatient">Outpatient</option>
                  <option value="day-care">Day-care</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Chief Complaint *</label>
                <textarea
                  required
                  className={inputClass}
                  rows={3}
                  placeholder="e.g. Chest pain and shortness of breath"
                  value={form.chief_complaint}
                  onChange={(e) => set("chief_complaint", e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id="medico_legal"
                  type="checkbox"
                  checked={form.medico_legal}
                  onChange={(e) => set("medico_legal", e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-reception-accent focus:ring-reception-accent"
                />
                <label htmlFor="medico_legal" className="text-sm font-medium text-slate-700">
                  Medico-legal case
                </label>
              </div>

              {form.medico_legal && (
                <div className="sm:col-span-2">
                  <label className={labelClass}>FIR Number *</label>
                  <input
                    required
                    className={inputClass}
                    value={form.fir_number}
                    onChange={(e) => set("fir_number", e.target.value)}
                  />
                  <p className="mt-1 text-xs text-slate-400">Cannot be edited once saved.</p>
                </div>
              )}

              {form.intake_channel === "emergency" && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <input
                    id="defer_payment"
                    type="checkbox"
                    checked={form.defer_payment}
                    onChange={(e) => set("defer_payment", e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-reception-accent focus:ring-reception-accent"
                  />
                  <label htmlFor="defer_payment" className="text-sm font-medium text-slate-700">
                    Defer payment (collect before discharge)
                  </label>
                </div>
              )}
            </div>
          </Panel>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          {successLink && (
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
              Patient registered. Payment link sent: {successLink}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-reception-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {submitting ? "Registering…" : "Register Patient"}
          </button>
        </div>

        <div className="space-y-6">
          <Panel title="Registration Guide">
            <ul className="space-y-3 text-sm text-slate-600">
              <li>
                <span className="font-semibold text-slate-800">Emergency walk-in</span> — profile goes active
                immediately; auto-assignment and payment run right away (unless deferred).
              </li>
              <li>
                <span className="font-semibold text-slate-800">Phone appointment</span> — saved as a draft; flip it
                to active from the Patient List once the patient arrives.
              </li>
              <li>
                <span className="font-semibold text-slate-800">Website booking</span> — saved as pending; review and
                confirm it from the Patient List after the patient's mobile is OTP-verified.
              </li>
            </ul>
          </Panel>
        </div>
      </form>
    </ReceptionShell>
  );
}
