"use client";

// components/parent/MyChildTodayWidget.tsx
// Refactored to align with UUID-based diary schema and professional relations.

import type {
  AttendanceRecord,
  ChildWithAssessments,
} from "@/lib/types/parent";
import { TeacherDiaryEntry, isHomework } from "@/lib/types/diary";
import {
  CalendarCheck,
  Clock,
  FileText,
  GraduationCap,
  CheckCircle2,
  XCircle,
  BookOpen,
} from "lucide-react";

interface Props {
  child: ChildWithAssessments;
  attendance: AttendanceRecord[];
  diary: TeacherDiaryEntry[];
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
  present: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    text: "At school today",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    textColor: "text-emerald-700",
  },
  absent: {
    icon: <XCircle className="h-4 w-4" />,
    text: "Absent today",
    bg: "bg-rose-50",
    border: "border-rose-200",
    textColor: "text-rose-700",
  },
  late: {
    icon: <Clock className="h-4 w-4" />,
    text: "Arrived late today",
    bg: "bg-amber-50",
    border: "border-amber-200",
    textColor: "text-amber-700",
  },
  excused: {
    icon: <FileText className="h-4 w-4" />,
    text: "Excused absence",
    bg: "bg-sky-50",
    border: "border-sky-200",
    textColor: "text-sky-700",
  },
};

// ── CBC score display config (Standardized for Kenyan CBC) ────────────────────
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
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAtt = attendance.find((a) => a.date.slice(0, 10) === todayStr);
  
  // Note: Standardized keys to lowercase to match typical DB enum returns
  const attStatusKey = todayAtt?.status.toLowerCase() || "";
  const attConfig = STATUS_CONFIG[attStatusKey];

  const recentDiary = diary[0] ?? null;
  const lastScore = child.assessments?.[0] ?? null;
  const scoreConfig = lastScore?.score ? SCORE_CONFIG[lastScore.score] : null;

  if (!todayAtt && !recentDiary && !lastScore) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Title bar */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
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

      <div className="divide-y divide-slate-100">
        {/* ── Attendance Section ─────────────────────────────────────────── */}
        {todayAtt && attConfig ? (
          <div className={`flex items-center gap-3 px-4 py-3 ${attConfig.bg}`}>
            <span className={`${attConfig.textColor} shrink-0`}>
              {attConfig.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-black ${attConfig.textColor}`}>
                {attConfig.text}
              </p>
              {todayAtt.notes && (
                <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                  {todayAtt.notes}
                </p>
              )}
            </div>
            <span
              className={`text-[10px] font-black border px-2 py-0.5 rounded-lg bg-white/80 uppercase ${attConfig.textColor} ${attConfig.border}`}
            >
              {todayAtt.status}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/50">
            <CalendarCheck className="h-4 w-4 text-slate-300 shrink-0" />
            <p className="text-xs text-slate-400 font-bold italic">
              Attendance check-in pending...
            </p>
          </div>
        )}

        {/* ── Latest Diary Section ────────────────────────────────────────── */}
        <div className="p-4 bg-white">
          {recentDiary ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                      Latest {recentDiary.entry_type}
                    </span>
                    {recentDiary.subject_name && (
                      <span className="h-1 w-1 rounded-full bg-slate-200" />
                    )}
                    <span className="text-[10px] font-bold text-slate-400">
                      {recentDiary.subject_name}
                    </span>
                  </div>
                  <p className="text-sm font-black text-slate-800 leading-tight">
                    {recentDiary.title}
                  </p>
                </div>
                <BookOpen className="h-4 w-4 text-slate-200 shrink-0" />
              </div>

              <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                {recentDiary.content || "Notes from teacher recorded."}
              </p>

              {/* Homework UI Alignment */}
              {isHomework(recentDiary) && (
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[9px] font-black uppercase tracking-wider text-blue-700">
                      📝 Homework Task
                    </p>
                    {recentDiary.due_date && (
                      <p className="text-[9px] font-black text-blue-700/60 uppercase">
                        Due: {new Date(recentDiary.due_date).toLocaleDateString("en-KE")}
                      </p>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 font-medium line-clamp-2">
                    Complete the following {recentDiary.subject_name?.toLowerCase()} exercise.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <div className="h-4 w-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-400">
                  {recentDiary.profiles?.full_name?.charAt(0) || "T"}
                </div>
                <p className="text-[10px] font-bold text-slate-400">
                  Posted by {recentDiary.profiles?.full_name || "Class Teacher"}
                </p>
              </div>
            </div>
          ) : (
            <div className="py-4 text-center border-2 border-dashed border-slate-50 rounded-xl">
              <p className="text-xs text-slate-400 font-semibold italic">No diary entries for today yet</p>
            </div>
          )}
        </div>

        {/* ── Last CBC score ──────────────────────────────────────────────── */}
        {lastScore && scoreConfig && (
          <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/30">
            <GraduationCap className="h-4 w-4 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                CBC Assessment
              </p>
              <p className="text-xs font-bold text-slate-700 truncate">
                {lastScore.subject_name}
              </p>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <span
                className={`text-xs font-black border rounded-lg px-2 py-0.5 ${scoreConfig.bg} ${scoreConfig.textColor} ${scoreConfig.border}`}
              >
                {lastScore.score}
              </span>
              <span className="text-[8px] font-bold text-slate-400 mt-0.5">
                {scoreConfig.label.split(" ")[0]}...
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}