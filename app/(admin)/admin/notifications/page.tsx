// app/admin/notifications/page.tsx
// Admin notification centre — read-only view of all system-generated
// notifications across the school: absence alerts, report card delivery,
// communications sent, fee reminders, and in-app parent notifications.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ArrowLeft, Bell } from "lucide-react";
import Link from "next/link";
import { NotificationsClient } from "./NotificationsClient";
import { getActiveTermYear } from "@/lib/utils/settings";

export const metadata = { title: "Notifications | Kibali Admin" };
export const revalidate = 0;

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchNotificationData() {
  const { academicYear } = await getActiveTermYear();

  const [{ data: parentNotifs }, { data: commsLog }, { data: inAppNotifs }] =
    await Promise.all([
      // SMS/Email delivery log (absence alerts, report-ready, fee reminders)
      supabaseAdmin
        .from("parent_notifications")
        .select(
          `
        id, type, channel, status, subject, body, created_at,
        parents ( id, full_name, phone_number, email )
      `,
        )
        .order("created_at", { ascending: false })
        .limit(200),

      // Broadcast communications sent by admins
      supabaseAdmin
        .from("communications_log")
        .select(
          "id, audience_type, audience_label, subject, body_preview, recipient_count, status, channel, sent_at, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100),

      // In-app notifications (teacher → parent bell notifications)
      supabaseAdmin
        .from("notifications")
        .select(
          `
        id, type, title, body, is_read, created_at,
        students ( id, full_name, current_grade )
      `,
        )
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

  return {
    parentNotifs: (parentNotifs ?? []) as any[],
    commsLog: (commsLog ?? []) as any[],
    inAppNotifs: (inAppNotifs ?? []) as any[],
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminNotificationsPage() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role))
    redirect("/login");

  const { parentNotifs, commsLog, inAppNotifs } = await fetchNotificationData();

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 right-1/4 w-[600px] h-[600px] rounded-full bg-sky-500/[0.03] blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-amber-500/[0.03] blur-[100px]" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors"
            >
              <ArrowLeft className="h-4 w-4 text-white/50" />
            </Link>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-400/10 border border-sky-400/20">
              <Bell className="h-6 w-6 text-sky-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-sky-400/70">
                Kibali Academy
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Notification Centre
              </h1>
              <p className="text-[11px] text-white/25 mt-0.5">
                All system-generated alerts, delivery logs, and broadcast
                history
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3">
            <Chip
              label="Delivery log"
              value={parentNotifs.length}
              color="sky"
            />
            <Chip label="Broadcasts" value={commsLog.length} color="amber" />
            <Chip label="In-app" value={inAppNotifs.length} color="emerald" />
          </div>
        </header>

        <NotificationsClient
          parentNotifs={parentNotifs}
          commsLog={commsLog}
          inAppNotifs={inAppNotifs}
        />
      </div>
    </div>
  );
}

function Chip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const cls: Record<string, string> = {
    sky: "bg-sky-400/10     border-sky-400/20     text-sky-400",
    amber: "bg-amber-400/10   border-amber-400/20   text-amber-400",
    emerald: "bg-emerald-400/10 border-emerald-400/20 text-emerald-400",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 text-center ${cls[color]}`}>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-white/25 uppercase tracking-wider">
        {label}
      </p>
    </div>
  );
}
