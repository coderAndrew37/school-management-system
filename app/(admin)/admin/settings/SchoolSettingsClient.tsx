"use client";

// app/admin/settings/_components/SchoolSettingsClient.tsx

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Settings,
  LayoutDashboard,
  Building2,
  CalendarDays,
  Bell,
  Upload,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import type { SchoolSettings } from "@/lib/actions/settings";
import { updateSchoolSettings, uploadSchoolLogo } from "@/lib/actions/settings";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  settings: SchoolSettings;
  logoPublicUrl: string | null;
}

type Tab = "identity" | "calendar" | "notifications";

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastState {
  type: "success" | "error";
  message: string;
}

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastState;
  onDismiss: () => void;
}) {
  return (
    <div
      onClick={onDismiss}
      className={[
        "fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl cursor-pointer transition-all",
        toast.type === "success"
          ? "bg-emerald-400/15 border border-emerald-400/30 text-emerald-400"
          : "bg-rose-400/15 border border-rose-400/30 text-rose-400",
      ].join(" ")}
    >
      {toast.type === "success" ? (
        <Check className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {toast.message}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function SchoolSettingsClient({ settings, logoPublicUrl }: Props) {
  const [tab, setTab] = useState<Tab>("identity");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  // Logo preview state
  const [previewUrl, setPreviewUrl] = useState<string | null>(logoPublicUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Save general settings ─────────────────────────────────────────────────

  async function handleSave(formData: FormData) {
    startTransition(async () => {
      const result = await updateSchoolSettings(formData);
      showToast(result.success ? "success" : "error", result.message);
    });
  }

  // ── Logo upload ───────────────────────────────────────────────────────────

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview immediately
    setPreviewUrl(URL.createObjectURL(file));
    setLogoUploading(true);

    const fd = new FormData();
    fd.set("logo", file);
    const result = await uploadSchoolLogo(fd);
    setLogoUploading(false);

    if (result.success) {
      showToast("success", result.message);
    } else {
      showToast("error", result.message);
      setPreviewUrl(logoPublicUrl); // revert preview on error
    }
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: "identity",
      label: "School Identity",
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      id: "calendar",
      label: "Academic Calendar",
      icon: <CalendarDays className="h-4 w-4" />,
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <Bell className="h-4 w-4" />,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-10 right-1/4 w-[500px] h-[300px] rounded-full bg-amber-500/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-violet-500/[0.03] blur-[100px]" />
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
              Kibali Academy · Admin
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20">
                <Settings className="h-5 w-5 text-amber-400" />
              </div>
              School Settings
            </h1>
            <p className="mt-1 text-xs text-white/35 ml-12">
              Identity · Academic calendar · Notification preferences
            </p>
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold border border-white/10 text-white/60 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
        </header>

        {/* ── Last updated banner ───────────────────────────────────────────── */}
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <p className="text-xs text-white/40">
            Last updated{" "}
            <span className="text-white/70">
              {new Date(settings.updated_at).toLocaleDateString("en-KE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </p>
        </div>

        {/* ── Tab nav ───────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5 w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all",
                tab === t.id
                  ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                  : "text-white/40 hover:text-white",
              ].join(" ")}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Panels ────────────────────────────────────────────────────────── */}
        <form action={handleSave} className="space-y-6">
          {tab === "identity" && (
            <IdentityPanel
              settings={settings}
              previewUrl={previewUrl}
              logoUploading={logoUploading}
              fileInputRef={fileInputRef}
              onLogoChange={handleLogoChange}
            />
          )}

          {tab === "calendar" && <CalendarPanel settings={settings} />}

          {tab === "notifications" && (
            <NotificationsPanel settings={settings} />
          )}

          {/* ── Save button (identity + calendar tabs) ─────────────────────── */}
          {tab !== "notifications" && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-bold text-[#0c0f1a] hover:bg-amber-300 disabled:opacity-50 transition-all"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          )}
        </form>

        {/* Notifications has its own save button with toggle UX */}
        {tab === "notifications" && (
          <NotificationsSavePanel
            settings={settings}
            onSave={(fd) => {
              startTransition(async () => {
                const result = await updateSchoolSettings(fd);
                showToast(result.success ? "success" : "error", result.message);
              });
            }}
            isPending={isPending}
          />
        )}
      </main>

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}

// ── Identity panel ────────────────────────────────────────────────────────────

function IdentityPanel({
  settings,
  previewUrl,
  logoUploading,
  fileInputRef,
  onLogoChange,
}: {
  settings: SchoolSettings;
  previewUrl: string | null;
  logoUploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onLogoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Logo */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <SectionHeading
          icon={<Upload className="h-4 w-4" />}
          title="School Logo"
        />
        <div className="flex items-center gap-6 mt-4">
          <div className="relative w-20 h-20 rounded-2xl border border-white/10 bg-white/[0.04] overflow-hidden flex items-center justify-center flex-shrink-0">
            {previewUrl ? (
              <Image
                src={previewUrl!}
                alt="School logo"
                fill
                unoptimized
                className="object-contain p-2"
              />
            ) : (
              <Building2 className="h-8 w-8 text-white/20" />
            )}
            {logoUploading && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
              </div>
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <Upload className="h-3.5 w-3.5" />
              {previewUrl ? "Replace Logo" : "Upload Logo"}
            </button>
            <p className="text-[10px] text-white/25 mt-1.5">
              PNG, JPEG, WEBP or SVG · Max 2 MB
            </p>
          </div>
          <input
            disabled={logoUploading}
            aria-label="upload logo"
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={onLogoChange}
          />
        </div>
      </div>

      {/* Details */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
        <SectionHeading
          icon={<Building2 className="h-4 w-4" />}
          title="School Details"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Field
            label="School Name *"
            name="school_name"
            defaultValue={settings.school_name}
            placeholder="e.g. Kibali Academy"
            required
          />
          <Field
            label="School Motto"
            name="school_motto"
            defaultValue={settings.school_motto ?? ""}
            placeholder="e.g. Preserving Excellence"
          />
          <Field
            label="Phone Number"
            name="school_phone"
            defaultValue={settings.school_phone ?? ""}
            placeholder="+254 712 345 678"
          />
          <Field
            label="Email Address"
            name="school_email"
            type="email"
            defaultValue={settings.school_email ?? ""}
            placeholder="info@school.ac.ke"
          />
        </div>

        <Field
          label="Physical Address"
          name="school_address"
          defaultValue={settings.school_address ?? ""}
          placeholder="Lang'ata Road, Karen South, Nairobi"
          textarea
        />
      </div>
    </div>
  );
}

// ── Calendar panel ────────────────────────────────────────────────────────────

function CalendarPanel({ settings }: { settings: SchoolSettings }) {
  return (
    <div className="space-y-5">
      {/* Active term / year */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <SectionHeading
          icon={<CalendarDays className="h-4 w-4" />}
          title="Current Period"
        />
        <p className="text-xs text-white/35 mt-0.5 mb-5">
          This is used as the default across analytics, fees, reports, and
          heatmap pages.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2">
              Current Term
            </p>
            <div className="flex gap-2">
              {([1, 2, 3] as const).map((t) => (
                <label key={t} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="current_term"
                    value={String(t)}
                    defaultChecked={settings.current_term === t}
                    className="peer sr-only"
                  />
                  <div className="rounded-xl border border-white/10 py-2 text-center text-xs font-bold text-white/40 transition-all peer-checked:bg-amber-400/15 peer-checked:border-amber-400/40 peer-checked:text-amber-400">
                    Term {t}
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="current_academic_year"
              className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2"
            >
              Academic Year
            </label>
            <select
              id="current_academic_year"
              name="current_academic_year"
              defaultValue={String(settings.current_academic_year)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50 transition-colors"
            >
              {[2024, 2025, 2026, 2027, 2028].map((y) => (
                <option key={y} value={String(y)} className="bg-[#0c0f1a]">
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Term dates */}
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-5">
        <SectionHeading
          icon={<CalendarDays className="h-4 w-4" />}
          title="Term Dates"
        />
        <p className="text-xs text-white/35">
          Used in attendance reports, parent notifications, and the school
          calendar.
        </p>

        {([1, 2, 3] as const).map((t) => (
          <div
            key={t}
            className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
          >
            <p className="text-xs font-bold text-white/70 mb-3 flex items-center gap-2">
              <span className="inline-flex w-5 h-5 rounded-md bg-amber-400/10 border border-amber-400/20 items-center justify-center text-[9px] font-black text-amber-400">
                {t}
              </span>
              Term {t}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <DateField
                label="Opening Date"
                name={`term${t}_start`}
                defaultValue={
                  (settings[
                    `term${t}_start` as keyof SchoolSettings
                  ] as string) ?? ""
                }
              />
              <DateField
                label="Closing Date"
                name={`term${t}_end`}
                defaultValue={
                  (settings[
                    `term${t}_end` as keyof SchoolSettings
                  ] as string) ?? ""
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Notifications panel ───────────────────────────────────────────────────────

function NotificationsPanel({ settings }: { settings: SchoolSettings }) {
  // This panel is display-only inside the main form — actual save is in NotificationsSavePanel
  return null;
}

function NotificationsSavePanel({
  settings,
  onSave,
  isPending,
}: {
  settings: SchoolSettings;
  onSave: (fd: FormData) => void;
  isPending: boolean;
}) {
  const [smsEnabled, setSmsEnabled] = useState(
    settings.sms_notifications_enabled,
  );
  const [emailEnabled, setEmailEnabled] = useState(
    settings.email_notifications_enabled,
  );

  function handleSubmit() {
    const fd = new FormData();
    // Carry forward identity fields so they don't get wiped
    fd.set("school_name", settings.school_name);
    fd.set("school_motto", settings.school_motto ?? "");
    fd.set("school_address", settings.school_address ?? "");
    fd.set("school_phone", settings.school_phone ?? "");
    fd.set("school_email", settings.school_email ?? "");
    fd.set("current_term", String(settings.current_term));
    fd.set("current_academic_year", String(settings.current_academic_year));
    fd.set("term1_start", settings.term1_start ?? "");
    fd.set("term1_end", settings.term1_end ?? "");
    fd.set("term2_start", settings.term2_start ?? "");
    fd.set("term2_end", settings.term2_end ?? "");
    fd.set("term3_start", settings.term3_start ?? "");
    fd.set("term3_end", settings.term3_end ?? "");
    fd.set("sms_notifications_enabled", String(smsEnabled));
    fd.set("email_notifications_enabled", String(emailEnabled));
    onSave(fd);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 space-y-4">
        <SectionHeading
          icon={<Bell className="h-4 w-4" />}
          title="Notification Channels"
        />
        <p className="text-xs text-white/35">
          Controls whether the system sends SMS (Africa&apos;s Talking) and
          email (Resend) notifications for absence alerts and report-ready
          notices.
        </p>

        <Toggle
          label="SMS Notifications"
          description="Absence alerts and report-ready SMS sent to parents via Africa's Talking"
          enabled={smsEnabled}
          onChange={setSmsEnabled}
          color="emerald"
        />

        <Toggle
          label="Email Notifications"
          description="Welcome emails, report notifications and parent invites via Resend"
          enabled={emailEnabled}
          onChange={setEmailEnabled}
          color="sky"
        />
      </div>

      {/* Info box */}
      <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-4 py-3 flex gap-3">
        <AlertCircle className="h-4 w-4 text-amber-400/70 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-400/70">
          Disabling a channel stops <strong>all</strong> outgoing messages of
          that type. Individual notification preferences per parent are not yet
          supported.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending}
          className="flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-bold text-[#0c0f1a] hover:bg-amber-300 disabled:opacity-50 transition-all"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Field primitives ──────────────────────────────────────────────────────────

function SectionHeading({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-amber-400/60">{icon}</div>
      <h3 className="text-sm font-bold text-white">{title}</h3>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
  required,
  textarea,
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const base =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/50 transition-colors";
  return (
    <div className={textarea ? "sm:col-span-2" : ""}>
      <label
        htmlFor={name}
        className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-2"
      >
        {label}
      </label>
      {textarea ? (
        <textarea
          id={name}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={2}
          className={base + " resize-none"}
        />
      ) : (
        <input
          id={name}
          type={type}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={required}
          className={base}
        />
      )}
    </div>
  );
}

function DateField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1.5"
      >
        {label}
      </label>
      <input
        id={name}
        type="date"
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/50 transition-colors [color-scheme:dark]"
      />
    </div>
  );
}

function Toggle({
  label,
  description,
  enabled,
  onChange,
  color = "emerald",
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  color?: "emerald" | "sky";
}) {
  const on =
    color === "emerald"
      ? "bg-emerald-400/20 border-emerald-400/40"
      : "bg-sky-400/20 border-sky-400/40";
  const dot = color === "emerald" ? "bg-emerald-400" : "bg-sky-400";

  return (
    <div
      className={[
        "flex items-start justify-between gap-4 rounded-xl border p-4 cursor-pointer transition-all",
        enabled ? `${on}` : "border-white/[0.07] bg-white/[0.02]",
      ].join(" ")}
      onClick={() => onChange(!enabled)}
    >
      <div>
        <p className="text-sm font-semibold text-white">{label}</p>
        <p className="text-xs text-white/40 mt-0.5">{description}</p>
      </div>
      {/* Toggle pill */}
      <div
        className={[
          "relative w-11 h-6 rounded-full border shrink-0 transition-all mt-0.5",
          enabled ? `${on}` : "border-white/15 bg-white/[0.05]",
        ].join(" ")}
      >
        <div
          className={[
            "absolute top-0.5 w-5 h-5 rounded-full transition-all duration-200",
            enabled ? `left-5 ${dot}` : "left-0.5 bg-white/20",
          ].join(" ")}
        />
      </div>
    </div>
  );
}
