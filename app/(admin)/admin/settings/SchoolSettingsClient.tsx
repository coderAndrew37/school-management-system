"use client";

// app/(admin)/settings/_components/SchoolSettingsClient.tsx

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import {
  Settings,
  LayoutDashboard,
  Building2,
  CalendarDays,
  Bell,
  Check,
  Loader2,
} from "lucide-react";
import type { SchoolSettings } from "@/lib/actions/settings";
import { updateSchoolSettings, uploadSchoolLogo } from "@/lib/actions/settings";
import { Toast, type ToastState } from "./UI";
import { IdentityPanel } from "./IdentityPanel";
import { CalendarPanel } from "./CalendarPanel";
import { NotificationsPanel } from "./NotificationsPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  settings: SchoolSettings;
  logoPublicUrl: string | null;
}

type Tab = "identity" | "calendar" | "notifications";

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

// ── Main ──────────────────────────────────────────────────────────────────────

export function SchoolSettingsClient({ settings, logoPublicUrl }: Props) {
  const [tab, setTab] = useState<Tab>("identity");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  const [previewUrl, setPreviewUrl] = useState<string | null>(logoPublicUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSave(formData: FormData) {
    startTransition(async () => {
      const result = await updateSchoolSettings(formData);
      showToast(result.success ? "success" : "error", result.message);
    });
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

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
      setPreviewUrl(logoPublicUrl);
    }
  }

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

        {/* Identity + Calendar share the main form action */}
        {tab !== "notifications" && (
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
          </form>
        )}

        {/* Notifications has its own save flow with toggle state */}
        {tab === "notifications" && (
          <NotificationsPanel
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