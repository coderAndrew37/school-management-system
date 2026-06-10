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
} from "lucide-react";
import type { SchoolSettings } from "@/lib/actions/settings";
import { updateSchoolSettings, uploadSchoolLogo } from "@/lib/actions/settings";
import { Toast, type ToastState } from "./UI";
import { IdentityPanel } from "./IdentityPanel";
import { CalendarPanel } from "./CalendarPanel";
import { NotificationsPanel } from "./NotificationsPanel";

// ── Types & Component Interfaces ─────────────────────────────────────────────

interface Props {
  settings: SchoolSettings;
  logoPublicUrl: string | null;
  // Permissions verified at the layout level passed down directly
  isSuperAdmin: boolean;
  allowedCatalogPermissions: string[]; 
}

type Tab = "identity" | "calendar" | "notifications";

const TABS_CONFIG = [
  {
    id: "identity" as Tab,
    label: "School Identity",
    icon: <Building2 className="h-4 w-4" />,
    permissionRequired: "settings.identity.write",
  },
  {
    id: "calendar" as Tab,
    label: "Academic Calendar",
    icon: <CalendarDays className="h-4 w-4" />,
    permissionRequired: "settings.calendar.write",
  },
  {
    id: "notifications" as Tab,
    label: "Notifications",
    icon: <Bell className="h-4 w-4" />,
    permissionRequired: "settings.notifications.write",
  },
];

// ── Main Controller ───────────────────────────────────────────────────────────

export function SchoolSettingsClient({ 
  settings, 
  logoPublicUrl, 
  isSuperAdmin, 
  allowedCatalogPermissions 
}: Props) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();

  const [previewUrl, setPreviewUrl] = useState<string | null>(logoPublicUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Dynamic Tab Generation: Filter tabs against resolved user capabilities
  const visibleTabs = TABS_CONFIG.filter(
    (t) => isSuperAdmin || allowedCatalogPermissions.includes(t.permissionRequired)
  );

  // Fallback state if the user has access to a sub-tab but isn't a super admin
  const [tab, setTab] = useState<Tab>(visibleTabs[0]?.id ?? "identity");

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  // Handle centralized triggers from panels that prefer programmatic bubbling (like Notifications)
  async function handleProgrammaticSave(formData: FormData) {
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
    
    try {
      const result = await uploadSchoolLogo(fd);
      showToast(result.success ? "success" : "error", result.message);
      if (!result.success) {
        setPreviewUrl(logoPublicUrl);
      }
    } catch (err) {
      showToast("error", "An unexpected asset sync error occurred.");
      setPreviewUrl(logoPublicUrl);
    } finally {
      setLogoUploading(false);
    }
  }

  // Security escape hatch: Guard against visual breaks if someone has zero permissions assigned
  if (visibleTabs.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-6">
        <p className="text-sm font-semibold text-red-400">Access Denied</p>
        <p className="text-xs text-white/40 mt-1 max-w-xs">
          You lack operational clearances inside the permission catalog to interact with system configurations.
        </p>
        <Link href="/admin" className="mt-4 text-xs font-bold text-amber-400 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient backgrounds */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-10 right-1/4 w-[500px] h-[300px] rounded-full bg-amber-500/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-violet-500/[0.03] blur-[100px]" />
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
              {settings.school_name} · Administrative Interface
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
            System Synchronization Baseline Last Altered{" "}
            <span className="text-white/70">
              {new Date(settings.updated_at).toLocaleDateString("en-KE", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </p>
        </div>

        {/* ── Tab Navigation ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5 w-max">
          {visibleTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTab(t.id);
                setToast(null);
              }}
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
        {/* Isolated Sub-components handle their own layout forms and status tracking hooks cleanly */}
        
        {tab === "identity" && (
          <IdentityPanel
            settings={settings}
            previewUrl={previewUrl}
            logoUploading={logoUploading}
            fileInputRef={fileInputRef}
            onLogoChange={handleLogoChange}
          />
        )}

        {tab === "calendar" && (
          <CalendarPanel settings={settings} />
        )}

        {tab === "notifications" && (
          <NotificationsPanel
            settings={settings}
            onSave={handleProgrammaticSave}
            isPending={isPending}
          />
        )}
      </main>

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}