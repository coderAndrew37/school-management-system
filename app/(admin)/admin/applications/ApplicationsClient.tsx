"use client";

// app/admin/applications/_components/ApplicationsClient.tsx

import type { PublicApplication, ApplicationStatus } from "@/lib/actions/applications";
import { updateApplicationStatus, convertApplicationToStudent } from "@/lib/actions/applications";
import {
  AlertCircle, Check, ChevronRight, ClipboardList,
  GraduationCap, LayoutDashboard, Loader2, UserPlus, X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  applications: PublicApplication[];
  counts: Record<string, number>;
  currentStatus: string;
  currentPage: number;
  totalCount: number;
}

const PAGE_SIZE = 20;

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  pending:   "bg-amber-400/15 border-amber-400/30 text-amber-400",
  reviewing: "bg-sky-400/15   border-sky-400/30   text-sky-400",
  approved:  "bg-emerald-400/15 border-emerald-400/30 text-emerald-400",
  declined:  "bg-rose-400/15  border-rose-400/30  text-rose-400",
};

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ApplicationsClient({
  applications, counts, currentStatus, currentPage, totalCount,
}: Props) {
  const router        = useRouter();
  const [selected, setSelected] = useState<PublicApplication | null>(null);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams({ status: currentStatus, page: String(currentPage), ...params });
    router.push(`/admin/applications?${sp.toString()}`);
  }

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleStatusChange(status: ApplicationStatus, notes?: string) {
    if (!selected) return;
    startTransition(async () => {
      const result = await updateApplicationStatus(selected.id, status, notes);
      showToast(result.success ? "success" : "error", result.message);
      if (result.success) {
        setSelected(null);
        router.refresh();
      }
    });
  }

  async function handleConvert() {
    if (!selected) return;
    startTransition(async () => {
      const result = await convertApplicationToStudent(selected.id);
      showToast(result.success ? "success" : "error", result.message);
      if (result.success) {
        setSelected(null);
        router.refresh();
      }
    });
  }

  const TABS = [
    { id: "all",       label: "All" },
    { id: "pending",   label: "Pending" },
    { id: "reviewing", label: "Reviewing" },
    { id: "approved",  label: "Approved" },
    { id: "declined",  label: "Declined" },
  ];

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-10 right-1/4 w-[500px] h-[300px] rounded-full bg-amber-500/[0.03] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-violet-500/[0.03] blur-[100px]" />
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
              Kibali Academy · Admin
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20">
                <ClipboardList className="h-5 w-5 text-amber-400" />
              </div>
              Admission Applications
            </h1>
            <p className="mt-1 text-xs text-white/35 ml-12">
              Review and process website admission applications
            </p>
          </div>
          <a href="/admin/dashboard"
            className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold border border-white/10 text-white/60 hover:text-white hover:border-white/20 hover:bg-white/5 transition-all">
            <LayoutDashboard className="h-4 w-4" />Dashboard
          </a>
        </header>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Pending",   count: counts.pending,   color: "amber" },
            { label: "Reviewing", count: counts.reviewing, color: "sky" },
            { label: "Approved",  count: counts.approved,  color: "emerald" },
            { label: "Declined",  count: counts.declined,  color: "rose" },
          ].map(({ label, count, color }) => (
            <div key={label}
              className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 cursor-pointer hover:bg-white/[0.04] transition-all"
              onClick={() => navigate({ status: label.toLowerCase(), page: "1" })}>
              <p className="text-xs text-white/40 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-2xl font-black text-${color}-400`}>{count}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5 w-max flex-wrap">
          {TABS.map((t) => (
            <button key={t.id}
              onClick={() => navigate({ status: t.id, page: "1" })}
              className={[
                "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                currentStatus === t.id
                  ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                  : "text-white/40 hover:text-white",
              ].join(" ")}
            >
              {t.label}
              <span className="ml-0.5 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-white/50">
                {counts[t.id] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          {applications.length === 0 ? (
            <div className="py-20 text-center">
              <ClipboardList className="h-10 w-10 text-white/10 mx-auto mb-3" />
              <p className="text-sm text-white/30">No applications found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Reference", "Student", "Grade", "Parent", "Contact", "Date", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-white/30">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {applications.map((app, i) => (
                  <tr key={app.id}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}>
                    <td className="px-4 py-3 font-mono text-xs text-amber-400/80">{app.reference_number}</td>
                    <td className="px-4 py-3 text-white font-medium">
                      {app.student_first_name} {app.student_last_name}
                    </td>
                    <td className="px-4 py-3 text-white/60 text-xs">{app.applying_for_grade}</td>
                    <td className="px-4 py-3 text-white/70">
                      {app.parent_first_name} {app.parent_last_name}
                    </td>
                    <td className="px-4 py-3 text-white/50 text-xs">
                      <div>{app.parent_email}</div>
                      <div>{app.parent_phone}</div>
                    </td>
                    <td className="px-4 py-3 text-white/40 text-xs whitespace-nowrap">
                      {new Date(app.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setSelected(app)}
                        className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/[0.08] transition-all">
                        Review <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>{totalCount} application{totalCount !== 1 ? "s" : ""} total</span>
            <div className="flex gap-2">
              {currentPage > 1 && (
                <button onClick={() => navigate({ page: String(currentPage - 1) })}
                  className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/[0.05] transition-all">
                  ← Prev
                </button>
              )}
              <span className="px-3 py-1.5">Page {currentPage} of {totalPages}</span>
              {currentPage < totalPages && (
                <button onClick={() => navigate({ page: String(currentPage + 1) })}
                  className="rounded-lg border border-white/10 px-3 py-1.5 hover:bg-white/[0.05] transition-all">
                  Next →
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Detail drawer ────────────────────────────────────────────────────── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />

          {/* Panel */}
          <div className="w-full max-w-lg bg-[#0f1220] border-l border-white/[0.08] overflow-y-auto">
            <div className="sticky top-0 bg-[#0f1220] border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-400/70 font-mono">{selected.reference_number}</p>
                <h2 className="text-base font-bold text-white mt-0.5">
                  {selected.student_first_name} {selected.student_last_name}
                </h2>
              </div>
              <button aria-label='clear selected student' onClick={() => setSelected(null)}
                className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:text-white transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status */}
              <div className="flex items-center gap-3">
                <StatusBadge status={selected.status} />
                {selected.reviewed_at && (
                  <span className="text-xs text-white/30">
                    Reviewed {new Date(selected.reviewed_at).toLocaleDateString("en-KE")}
                  </span>
                )}
                {selected.converted_student_id && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400/70">
                    <GraduationCap className="h-3.5 w-3.5" /> Admitted
                  </span>
                )}
              </div>

              {/* Student */}
              <Section title="Student Details">
                <Row label="Name"       value={`${selected.student_first_name} ${selected.student_last_name}`} />
                <Row label="Gender"     value={selected.student_gender} />
                <Row label="DOB"        value={new Date(selected.student_dob).toLocaleDateString("en-KE")} />
                <Row label="Current"    value={selected.current_grade} />
                <Row label="Applying"   value={selected.applying_for_grade} />
              </Section>

              {/* Parent */}
              <Section title="Parent / Guardian">
                <Row label="Name"         value={`${selected.parent_first_name} ${selected.parent_last_name}`} />
                <Row label="Relationship" value={selected.parent_relationship} />
                <Row label="Email"        value={selected.parent_email} />
                <Row label="Phone"        value={selected.parent_phone} />
                {selected.city && <Row label="City" value={`${selected.city}${selected.postal_code ? ` – ${selected.postal_code}` : ""}`} />}
                {selected.address && <Row label="Address" value={selected.address} />}
              </Section>

              {/* Extras */}
              {(selected.previous_school || selected.special_needs || selected.interests) && (
                <Section title="Additional Info">
                  {selected.previous_school && <Row label="Prev. School" value={selected.previous_school} />}
                  {selected.special_needs    && <Row label="Special Needs" value={selected.special_needs} />}
                  {selected.interests        && <Row label="Interests" value={selected.interests} />}
                </Section>
              )}

              {/* Admin notes */}
              <AdminNotesSection
                applicationId={selected.id}
                currentStatus={selected.status}
                existingNotes={selected.admin_notes}
                isPending={isPending}
                onStatusChange={handleStatusChange}
                onConvert={handleConvert}
                isConverted={!!selected.converted_student_id}
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div onClick={() => setToast(null)}
          className={[
            "fixed bottom-6 right-6 z-[60] flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl cursor-pointer",
            toast.type === "success"
              ? "bg-emerald-400/15 border border-emerald-400/30 text-emerald-400"
              : "bg-rose-400/15 border border-rose-400/30 text-rose-400",
          ].join(" ")}
        >
          {toast.type === "success" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <p className="px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/30 border-b border-white/[0.06] bg-white/[0.02]">
        {title}
      </p>
      <div className="divide-y divide-white/[0.04]">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 px-4 py-2.5">
      <span className="text-xs text-white/30 w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-white/80 break-all">{value}</span>
    </div>
  );
}

function AdminNotesSection({
  applicationId, currentStatus, existingNotes,
  isPending, onStatusChange, onConvert, isConverted,
}: {
  applicationId: string;
  currentStatus: ApplicationStatus;
  existingNotes: string | null;
  isPending: boolean;
  onStatusChange: (status: ApplicationStatus, notes?: string) => void;
  onConvert: () => void;
  isConverted: boolean;
}) {
  const [notes, setNotes] = useState(existingNotes ?? "");

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
          Admin Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Internal notes — visible only to admin staff"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/50 transition-colors resize-none"
        />
      </div>

      {/* Status actions */}
      {currentStatus !== "approved" && currentStatus !== "declined" && (
        <div className="flex gap-2">
          {currentStatus === "pending" && (
            <ActionBtn
              label="Mark Reviewing"
              icon={<ClipboardList className="h-4 w-4" />}
              color="sky"
              onClick={() => onStatusChange("reviewing", notes)}
              disabled={isPending}
            />
          )}
          <ActionBtn
            label="Approve"
            icon={<Check className="h-4 w-4" />}
            color="emerald"
            onClick={() => onStatusChange("approved", notes)}
            disabled={isPending}
          />
          <ActionBtn
            label="Decline"
            icon={<X className="h-4 w-4" />}
            color="rose"
            onClick={() => onStatusChange("declined", notes)}
            disabled={isPending}
          />
        </div>
      )}

      {/* Convert to student */}
      {currentStatus === "approved" && !isConverted && (
        <button
          onClick={onConvert}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-[#0c0f1a] hover:bg-amber-300 disabled:opacity-50 transition-all"
        >
          {isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
          ) : (
            <><UserPlus className="h-4 w-4" /> Admit Student & Invite Parent</>
          )}
        </button>
      )}

      {/* Re-open declined */}
      {currentStatus === "declined" && (
        <ActionBtn
          label="Re-open Application"
          icon={<ClipboardList className="h-4 w-4" />}
          color="amber"
          onClick={() => onStatusChange("reviewing", notes)}
          disabled={isPending}
        />
      )}
    </div>
  );
}

function ActionBtn({ label, icon, color, onClick, disabled }: {
  label: string; icon: React.ReactNode;
  color: "sky" | "emerald" | "rose" | "amber";
  onClick: () => void; disabled: boolean;
}) {
  const styles = {
    sky:     "bg-sky-400/10 border-sky-400/30 text-sky-400 hover:bg-sky-400/20",
    emerald: "bg-emerald-400/10 border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/20",
    rose:    "bg-rose-400/10 border-rose-400/30 text-rose-400 hover:bg-rose-400/20",
    amber:   "bg-amber-400/10 border-amber-400/30 text-amber-400 hover:bg-amber-400/20",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold disabled:opacity-50 transition-all ${styles[color]}`}>
      {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}