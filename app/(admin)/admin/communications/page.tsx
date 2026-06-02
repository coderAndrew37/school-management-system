
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";
import type { Metadata } from "next";
import { getSession } from "@/lib/actions/auth";
import {
  fetchCommunicationRecipients,
  fetchCommunicationsLog,
} from "@/lib/data/communications";
import { CommunicationsClient } from "@/app/_components/communications/CommunicationsClient";

export const metadata: Metadata = {
  title: "Communications | Kibali Academy",
  description: "Send announcements and messages to parents and staff",
};

// No ISR — we want fresh recipient lists and log on every visit
export const dynamic = "force-dynamic";

export default async function CommunicationsPage() {
  // ── Access Control Guard ───────────────────────────────────────────────────
  const session = await getSession();
  
  if (!session || !session.profile) {
    redirect("/login?redirectTo=/admin/communications");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  if (base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  // ── Data Loading ───────────────────────────────────────────────────────────
  const [recipients, sentLog] = await Promise.all([
    fetchCommunicationRecipients(),
    fetchCommunicationsLog(),
  ]);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-60 left-1/4 w-[700px] h-[700px] rounded-full bg-amber-500/[0.03] blur-[140px]" />
        <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full bg-sky-500/[0.03] blur-[120px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors duration-200"
            >
              <ArrowLeft className="h-4 w-4 text-white/50" />
            </Link>

            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20">
                <Mail className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
                  Kibali Academy
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Communications
                </h1>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 sm:ml-auto bg-white/[0.02] border border-white/[0.05] p-3 rounded-xl">
            <div className="text-right px-2">
              <p className="text-[10px] uppercase tracking-wider text-white/25">Teachers</p>
              <p className="text-lg font-bold text-white tabular-nums">
                {recipients.teachers.length}
              </p>
            </div>
            <div className="h-8 w-px bg-white/[0.07]" />
            <div className="text-right px-2">
              <p className="text-[10px] uppercase tracking-wider text-white/25">Parents</p>
              <p className="text-lg font-bold text-white tabular-nums">
                {recipients.parents.length}
              </p>
            </div>
            <div className="h-8 w-px bg-white/[0.07]" />
            <div className="text-right px-2">
              <p className="text-[10px] uppercase tracking-wider text-white/25">Sent</p>
              <p className="text-lg font-bold text-white tabular-nums">
                {sentLog.filter((e) => e.status === "sent").length}
              </p>
            </div>
          </div>
        </header>

        {/* Main UI */}
        <CommunicationsClient
          recipients={recipients}
          sentLog={sentLog}
          grades={recipients.grades}
        />

        {/* Footer */}
        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy Portal · Emails sent via Resend
          </p>
        </footer>
      </div>
    </div>
  );
}