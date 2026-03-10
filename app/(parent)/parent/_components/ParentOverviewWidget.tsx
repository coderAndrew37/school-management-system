"use client";

// components/parent/MyChildTodayWidget.tsx
// "My Child Today" — single-glance widget for the parent overview page.
// Shows: today's attendance, last diary entry, last CBC score.

// ── Imports ───────────────────────────────────────────────────────────────────
// AttendanceRecord and DiaryEntry live in @/lib/types/parent — they are
// imported there by parent-data.ts but NOT re-exported from it.
// ChildWithAssessments is also in @/lib/types/parent.
import type {
  AttendanceRecord,
  ChildWithAssessments,
  DiaryEntry,
} from "@/lib/types/parent";
import {
  BookOpen,
  CalendarCheck,
  Clock,
  FileText,
  GraduationCap,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface Props {
  child: ChildWithAssessments;
  attendance: AttendanceRecord[];
  diary: DiaryEntry[];
}

// ── Attendance status display config ─────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  {
    icon: React.ReactNode;
    text: string;
    bg: string;
    border: string;
    textColor: string;
  }
> = {
  Present: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    text: "At school today",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    textColor: "text-emerald-700",
  },
  Absent: {
    icon: <XCircle className="h-4 w-4" />,
    text: "Absent today",
    bg: "bg-rose-50",
    border: "border-rose-200",
    textColor: "text-rose-700",
  },
  Late: {
    icon: <Clock className="h-4 w-4" />,
    text: "Arrived late today",
    bg: "bg-amber-50",
    border: "border-amber-200",
    textColor: "text-amber-700",
  },
  Excused: {
    icon: <FileText className="h-4 w-4" />,
    text: "Excused absence",
    bg: "bg-sky-50",
    border: "border-sky-200",
    textColor: "text-sky-700",
  },
};

// ── CBC score display config ──────────────────────────────────────────────────
const SCORE_CONFIG: Record<
  string,
  { label: string; bg: string; textColor: string; border: string }
> = {
  EE: {
    label: "Exceeds Expectations",
    bg: "bg-emerald-50",
    textColor: "text-emerald-700",
    border: "border-emerald-200",
  },
  ME: {
    label: "Meets Expectations",
    bg: "bg-sky-50",
    textColor: "text-sky-700",
    border: "border-sky-200",
  },
  AE: {
    label: "Approaches Exp.",
    bg: "bg-amber-50",
    textColor: "text-amber-700",
    border: "border-amber-200",
  },
  BE: {
    label: "Below Expectations",
    bg: "bg-rose-50",
    textColor: "text-rose-700",
    border: "border-rose-200",
  },
};

export function MyChildTodayWidget({ child, attendance, diary }: Props) {
  // ── AttendanceRecord.date is the correct column name ─────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAtt = attendance.find((a) => a.date.slice(0, 10) === todayStr);
  const attConfig = todayAtt ? STATUS_CONFIG[todayAtt.status] : null;

  // ── DiaryEntry fields: .body (not .entry_text), .diary_date (not .date) ──
  const lastDiary = diary[0] ?? null;
  const lastScore = child.assessments[0] ?? null;
  const scoreConfig = lastScore?.score ? SCORE_CONFIG[lastScore.score] : null;

  // Render nothing if there is genuinely no data yet for today
  if (!todayAtt && !lastDiary && !lastScore) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Title bar */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
        <div className="h-6 w-6 rounded-lg bg-blue-600 flex items-center justify-center">
          <span className="text-white text-[10px] font-black">✦</span>
        </div>
        <p className="text-sm font-black text-slate-800">
          {child.full_name.split(" ")[0]} Today
        </p>
        <p className="text-[10px] text-slate-400 font-semibold ml-auto">
          {new Date().toLocaleDateString("en-KE", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </p>
      </div>

      <div className="divide-y divide-slate-50">
        {/* ── Attendance ─────────────────────────────────────────────────── */}
        {todayAtt && attConfig ? (
          <div className={`flex items-center gap-3 px-4 py-3 ${attConfig.bg}`}>
            <span className={`${attConfig.textColor} shrink-0`}>
              {attConfig.icon}
            </span>
            <div>
              <p className={`text-xs font-black ${attConfig.textColor}`}>
                {attConfig.text}
              </p>
              {todayAtt.notes && (
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {todayAtt.notes}
                </p>
              )}
            </div>
            <span
              className={`ml-auto text-[10px] font-black border px-2 py-0.5 rounded-lg bg-white/60 ${attConfig.textColor} ${attConfig.border}`}
            >
              {todayAtt.status}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
            <CalendarCheck className="h-4 w-4 text-slate-400 shrink-0" />
            <p className="text-xs text-slate-500 font-semibold">
              Attendance not yet recorded for today
            </p>
          </div>
        )}

        {/* ── Latest diary ────────────────────────────────────────────────── */}
        {/* DiaryEntry.body = the text content (NOT .entry_text)             */}
        {/* DiaryEntry.diary_date = the date column (NOT .date)              */}
        {lastDiary && (
          <div className="flex items-start gap-3 px-4 py-3">
            <BookOpen className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                Latest Diary
              </p>
              {lastDiary.subject_name && (
                <p className="text-xs font-bold text-slate-700 line-clamp-1">
                  {lastDiary.subject_name}
                </p>
              )}
              <p className="text-xs text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                {lastDiary.body}
              </p>
            </div>
            <p className="text-[10px] text-slate-400 shrink-0 mt-0.5">
              {new Date(
                lastDiary.diary_date.includes("T")
                  ? lastDiary.diary_date
                  : lastDiary.diary_date + "T00:00:00",
              ).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
            </p>
          </div>
        )}

        {/* ── Last CBC score ──────────────────────────────────────────────── */}
        {lastScore && scoreConfig && (
          <div className="flex items-center gap-3 px-4 py-3">
            <GraduationCap className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                Latest Assessment
              </p>
              <p className="text-xs font-bold text-slate-700 line-clamp-1">
                {lastScore.subject_name}
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {lastScore.strand_id}
              </p>
            </div>
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span
                className={`text-sm font-black border rounded-lg px-2 py-0.5 ${scoreConfig.bg} ${scoreConfig.textColor} ${scoreConfig.border}`}
              >
                {lastScore.score}
              </span>
              <span className="text-[9px] text-slate-400">
                {scoreConfig.label}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
