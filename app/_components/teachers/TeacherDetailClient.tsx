"use client";

import { assignClassTeacherAction } from "@/lib/actions/class-teacher";
import {
  changeTeacherStatusAction,
  resendTeacherInviteAction,
} from "@/lib/actions/teachers";
import {
  AllocationRow,
  ClassTeacherAssignment,
  Teacher,
  TeacherStats,
} from "@/lib/types/dashboard";
import { getTeacherPhotoUrl } from "@/lib/utils/photo-utils";
import {
  Award,
  BookOpen,
  Building2,
  Check,
  ChevronLeft,
  FileText,
  GraduationCap,
  Mail,
  Phone,
  RefreshCw,
  Shield,
  Star,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  teacher: Teacher;
  allocations: AllocationRow[];
  stats: TeacherStats;
  classAssignments: ClassTeacherAssignment[];
  academicYear: number;
  term: number;
}

type Tab = "workload" | "documents";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active: {
    label: "Active",
    dot: "bg-emerald-400",
    badge: "bg-emerald-400/10 border-emerald-400/30 text-emerald-400",
    pulse: true,
  },
  on_leave: {
    label: "On Leave",
    dot: "bg-amber-400",
    badge: "bg-amber-400/10 border-amber-400/30 text-amber-400",
    pulse: false,
  },
  resigned: {
    label: "Resigned",
    dot: "bg-rose-400",
    badge: "bg-rose-400/10 border-rose-400/30 text-rose-400",
    pulse: false,
  },
  terminated: {
    label: "Terminated",
    dot: "bg-slate-500",
    badge: "bg-slate-500/10 border-slate-500/30 text-slate-400",
    pulse: false,
  },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: keyof typeof STATUS_CFG }) {
  const cfg = STATUS_CFG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${cfg.badge}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`}
      />
      {cfg.label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-2">
      <div className="flex items-center gap-2 text-white/30">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {label}
        </span>
      </div>
      <p className="text-2xl font-black text-white tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-white/25">{sub}</p>}
    </div>
  );
}

// ── Document placeholder ──────────────────────────────────────────────────────

function DocPlaceholder({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-dashed border-white/10 bg-white/[0.01] px-4 py-3 hover:border-white/20 transition-colors cursor-pointer group">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/25 group-hover:text-white/50 transition-colors">
          {icon}
        </div>
        <span className="text-sm text-white/35 group-hover:text-white/60 transition-colors">
          {label}
        </span>
      </div>
      <span className="text-[10px] text-white/20 font-semibold uppercase tracking-wider">
        Upload
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TeacherDetailClient({
  teacher,
  allocations,
  stats,
  classAssignments,
  academicYear,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("workload");
  const [isPending, start] = useTransition();

  const photoUrl = getTeacherPhotoUrl(teacher.avatar_url);
  const staffId =
    (teacher as Teacher & { staff_id?: string }).staff_id ?? teacher.id;

  function handleResend() {
    start(async () => {
      const res = await resendTeacherInviteAction(teacher.id);
      toast[res.success ? "success" : "error"](res.message);
    });
  }

  function handleStatusChange(status: Teacher["status"]) {
    start(async () => {
      const res = await changeTeacherStatusAction(teacher.id, status);
      if (res.success) {
        toast.success(res.message);
        router.refresh();
      } else toast.error(res.message);
    });
  }

  // Determine current active class teacher roles from assignments
  const activeAssignments = classAssignments.filter((a) => a.isActive);

  // Unique grade identifiers (ID + Stream) teacher covers in subjects
  // We use this to allow clicking a button to assign them
  const allocGrades = Array.from(
    new Map(allocations.map((a) => [`${a.grade}-${a.stream}`, a])).values(),
  ).sort((a, b) => a.grade.localeCompare(b.grade));

  const activeGradeKeys = new Set(
    activeAssignments.map((a) => `${a.grade}-${a.stream}`),
  );

  async function toggleClassTeacher(classId: string, gradeStr: string) {
    start(async () => {
      const res = await assignClassTeacherAction({
        classId,
        teacherId: teacher.id,
        academicYear,
      });
      if (res.success) {
        toast.success(`Assigned as class teacher for ${gradeStr}`);
        router.refresh();
      } else toast.error(res.message);
    });
  }

  return (
    <div className="min-h-screen bg-[#090c18] text-white">
      {/* Top nav bar */}
      <div className="sticky top-0 z-20 bg-[#090c18]/80 backdrop-blur-md border-b border-white/[0.06] px-6 py-3 flex items-center gap-4">
        <Link
          href="/admin/teachers"
          className="flex items-center gap-1.5 text-xs font-semibold text-white/35 hover:text-white/70 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Teachers
        </Link>
        <span className="text-white/15">/</span>
        <span className="text-xs text-white/50 font-mono">{staffId}</span>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href={`/admin/teachers`}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10 text-white/40 hover:text-white hover:bg-white/[0.05] transition-colors"
          >
            ← Back to Directory
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* ── HERO HEADER ── */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 sm:p-8 overflow-hidden relative">
          <div className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-amber-400/[0.04] blur-3xl" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 relative">
            <div className="relative shrink-0">
              <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden border-2 border-white/10 bg-white/[0.04] flex items-center justify-center">
                {photoUrl ? (
                  <Image
                    src={photoUrl}
                    alt={teacher.full_name}
                    fill
                    className="object-cover"
                    sizes="112px"
                  />
                ) : (
                  <span className="text-3xl font-black text-white/40">
                    {teacher.full_name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <div className="absolute -bottom-2 -right-2">
                <StatusBadge status={teacher.status} />
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] font-black font-mono tracking-widest text-amber-400/70 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg">
                  {staffId}
                </span>
                {activeAssignments.length > 0 && (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <GraduationCap className="h-3 w-3" /> Class Teacher ·{" "}
                    {activeAssignments
                      .map((a) => `${a.grade} ${a.stream}`)
                      .join(", ")}
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {teacher.full_name}
              </h1>
              <div className="flex flex-wrap gap-4 text-sm text-white/40">
                {teacher.tsc_number && (
                  <span className="flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-amber-400/50" /> TSC:{" "}
                    <span className="font-mono text-white/60">
                      {teacher.tsc_number}
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-sky-400/50" />
                  {stats.yearsAtKibali === 0
                    ? "Joined this year"
                    : `${stats.yearsAtKibali}yr${stats.yearsAtKibali !== 1 ? "s" : ""} at Kibali`}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 shrink-0">
              <a
                href={`mailto:${teacher.email}`}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                <Mail className="h-3.5 w-3.5" /> Message
              </a>
              {teacher.phone_number && (
                <a
                  href={`tel:${teacher.phone_number}`}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/[0.08] transition-all"
                >
                  <Phone className="h-3.5 w-3.5" /> Call
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">
          <div className="space-y-4">
            <div className="flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
              {(
                [
                  {
                    id: "workload",
                    label: "Academic Load",
                    icon: <BookOpen className="h-3.5 w-3.5" />,
                  },
                  {
                    id: "documents",
                    label: "Documents",
                    icon: <FileText className="h-3.5 w-3.5" />,
                  },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all ${tab === t.id ? "bg-white/[0.08] text-white shadow-sm" : "text-white/25 hover:text-white/55"}`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "workload" && (
              <div className="space-y-3">
                {allocations.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
                    <BookOpen className="h-8 w-8 text-white/10 mx-auto mb-3" />
                    <p className="text-white/25 text-sm">
                      No subject allocations for {academicYear}.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {allocations.map((a) => (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 hover:border-white/15 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <span className="text-[10px] font-black font-mono px-2 py-1 rounded-lg bg-emerald-400/10 text-emerald-400 border border-emerald-400/20">
                            {a.subjectCode}
                          </span>
                          <span className="text-[10px] text-white/25 font-semibold uppercase tracking-wider">
                            {a.grade} {a.stream}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-white">
                          {a.subjectName}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {allocGrades.length > 0 && (
                  <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-amber-400/60" />
                      <p className="text-xs font-black uppercase tracking-wider text-white/50">
                        Class Teacher Assignment
                      </p>
                    </div>
                    <p className="text-[11px] text-white/25">
                      Designate this teacher as the lead class teacher for their
                      assigned streams.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {allocGrades.map((g) => {
                        const key = `${g.grade}-${g.stream}`;
                        const isClass = activeGradeKeys.has(key);
                        return (
                          <button
                            key={key}
                            onClick={() =>
                              !isClass &&
                              toggleClassTeacher(
                                g.class_id,
                                `${g.grade} ${g.stream}`,
                              )
                            }
                            disabled={isPending}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${isClass ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400 cursor-default" : "border-white/10 bg-white/[0.03] text-white/40 hover:border-amber-400/30 hover:text-amber-400 hover:bg-amber-400/[0.06]"}`}
                          >
                            {isClass ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <GraduationCap className="h-3 w-3" />
                            )}
                            {g.grade} {g.stream}
                          </button>
                        );
                      })}
                    </div>
                    {activeAssignments.length > 0 && (
                      <p className="text-[10px] text-white/20">
                        To relieve a teacher of their duties, use the{" "}
                        <Link
                          href="/admin/class-teachers"
                          className="text-amber-400/60 hover:text-amber-400 underline"
                        >
                          Governance Portal
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "documents" && (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-3">
                  <p className="text-xs font-black uppercase tracking-wider text-white/30 mb-1">
                    Compliance Documents
                  </p>
                  {[
                    {
                      label: "TSC Certificate",
                      icon: <Shield className="h-4 w-4" />,
                    },
                    {
                      label: "National ID / Passport",
                      icon: <FileText className="h-4 w-4" />,
                    },
                    {
                      label: "KRA PIN Certificate",
                      icon: <Building2 className="h-4 w-4" />,
                    },
                    {
                      label: "Academic Transcripts",
                      icon: <GraduationCap className="h-4 w-4" />,
                    },
                    {
                      label: "Good Conduct Certificate",
                      icon: <Award className="h-4 w-4" />,
                    },
                  ].map((d) => (
                    <DocPlaceholder key={d.label} {...d} />
                  ))}
                </div>
                <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.03] px-4 py-3">
                  <p className="text-[11px] text-amber-400/60">
                    Files stored securely via encrypted Supabase Storage
                    buckets.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4 lg:sticky lg:top-20">
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Users className="h-3.5 w-3.5" />}
                label="Students"
                value={stats.totalStudents}
              />
              <StatCard
                icon={<BookOpen className="h-3.5 w-3.5" />}
                label="Classes"
                value={stats.totalClasses}
              />
              <StatCard
                icon={<Star className="h-3.5 w-3.5" />}
                label="Strands"
                value={stats.assessedStrands}
              />
              <StatCard
                icon={<Award className="h-3.5 w-3.5" />}
                label="Years"
                value={stats.yearsAtKibali === 0 ? "New" : stats.yearsAtKibali}
              />
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/25">
                Contact
              </p>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                    <Mail className="h-3.5 w-3.5 text-white/30" />
                  </div>
                  <span className="text-xs text-white/50 font-mono truncate">
                    {teacher.email}
                  </span>
                </div>
                {teacher.phone_number && (
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                      <Phone className="h-3.5 w-3.5 text-white/30" />
                    </div>
                    <span className="text-xs text-white/50 font-mono">
                      {teacher.phone_number}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/25 mb-3">
                Employment Status
              </p>
              {(["active", "on_leave", "resigned", "terminated"] as const).map(
                (s) => {
                  const cfg = STATUS_CFG[s];
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={isPending || teacher.status === s}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-xs font-semibold capitalize transition-all ${teacher.status === s ? `${cfg.badge} cursor-default` : "border-white/[0.06] bg-white/[0.02] text-white/35 hover:border-white/15 hover:text-white/60"}`}
                    >
                      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                      {s.replace("_", " ")}
                      {teacher.status === s && (
                        <Check className="h-3.5 w-3.5 ml-auto" />
                      )}
                    </button>
                  );
                },
              )}
            </div>

            <button
              onClick={handleResend}
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.05] px-4 py-3 text-xs font-semibold text-sky-400/70 hover:bg-sky-400/10 hover:text-sky-400 transition-all"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
              />
              Resend Portal Invite
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
