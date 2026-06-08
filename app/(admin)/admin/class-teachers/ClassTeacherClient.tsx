"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  assignClassTeacherAction,
  relieveClassTeacherAction,
} from "@/lib/actions/class-teacher";
import {
  Users,
  UserCheck,
  Trash2,
  Save,
  ChevronRight,
  GraduationCap,
  PlusCircle,
  AlertCircle,
  BarChart3,
} from "lucide-react";
import Link from "next/link";

// ── Exported types ────────────────────────────────────────────────────────────

export interface ClassRecord {
  id:     string;
  grade:  string;
  stream: string;
}

export interface TeacherOption {
  id:         string;
  full_name:  string;
  email:      string;
  tsc_number: string | null;
}

export interface AssignmentRow {
  id:            string;
  class_id:      string;
  academic_year: number;
  classes: {
    grade:  string;
    stream: string;
  };
  teacher: {
    id:        string;
    full_name: string;
    email:     string;
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  teachers:      TeacherOption[];
  classes:       ClassRecord[];
  assignments:   AssignmentRow[];
  studentCounts: Record<string, number>;
  academicYear:  number;
}

interface ToastState {
  msg: string;
  ok:  boolean;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AssignedCard({
  assignment,
  teachers,
  selections,
  onSelectionChange,
  onSave,
  onRelieve,
  isSaving,
  isPending,
}: {
  assignment:       AssignmentRow;
  teachers:         TeacherOption[];
  selections:       Record<string, string>;
  onSelectionChange: (classId: string, teacherId: string) => void;
  onSave:           (classId: string) => void;
  onRelieve:        (assignmentId: string, grade: string) => void;
  isSaving:         boolean;
  isPending:        boolean;
}) {
  const { id, class_id, classes, teacher } = assignment;
  const selectedId = selections[class_id] ?? teacher.id;
  const isDirty = selectedId !== teacher.id;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 flex items-center gap-4 hover:border-white/[0.12] transition-colors">
      {/* Avatar */}
      <div className="h-11 w-11 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center shrink-0">
        <GraduationCap className="h-5 w-5 text-emerald-400" />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-white truncate">
          {classes.grade}
          <span className="text-white/40 font-normal"> — </span>
          {classes.stream}
        </h3>
        <p className="text-xs text-emerald-400/80 truncate mt-0.5">
          {teacher.full_name}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          value={selectedId}
          onChange={(e) => onSelectionChange(class_id, e.target.value)}
          aria-label={`Select teacher for ${classes.grade} ${classes.stream}`}
          className="text-[11px] bg-white/[0.05] border border-white/[0.1] rounded-lg py-2 pl-2.5 pr-7 text-white/80 focus:outline-none focus:border-amber-400/40 transition-colors"
        >
          {teachers.map((t) => (
            <option key={t.id} value={t.id} className="bg-[#0c0f1a]">
              {t.full_name}
            </option>
          ))}
        </select>

        <button
          aria-label={`Save teacher for ${classes.grade}`}
          onClick={() => onSave(class_id)}
          disabled={isSaving || !isDirty}
          className={`p-2.5 rounded-lg transition-all disabled:opacity-30 ${
            isDirty
              ? "bg-amber-400/10 text-amber-400 hover:bg-amber-400 hover:text-[#0c0f1a]"
              : "bg-white/[0.03] text-white/20"
          }`}
        >
          <Save className="h-4 w-4" />
        </button>

        <button
          type="button"
          aria-label={`Relieve teacher from ${classes.grade}`}
          onClick={() => onRelieve(id, classes.grade)}
          disabled={isPending}
          className="p-2.5 rounded-lg bg-white/[0.03] text-white/30 hover:bg-rose-500/10 hover:text-rose-400 transition-all disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function UnassignedCard({
  cls,
  studentCounts,
  selections,
  onSelectionChange,
  onAssign,
  isPending,
}: {
  cls:              ClassRecord;
  studentCounts:    Record<string, number>;
  selections:       Record<string, string>;
  onSelectionChange: (classId: string, teacherId: never) => void;
  onAssign:         (classId: string) => void;
  isPending:        boolean;
  teachers:         TeacherOption[];
}) {
  const count = studentCounts[cls.grade];
  const hasSelection = Boolean(selections[cls.id]);

  return (
    <div className="rounded-2xl border border-dashed border-amber-400/20 bg-amber-400/[0.02] p-4 flex items-center gap-4 hover:border-amber-400/30 transition-colors">
      <div className="h-11 w-11 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
        <Users className="h-5 w-5 text-amber-400/70" />
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-white">
          {cls.grade}
          <span className="text-white/40 font-normal"> — </span>
          {cls.stream}
        </h3>
        {count !== undefined && (
          <p className="text-[11px] text-white/30 mt-0.5">
            {count} student{count !== 1 ? "s" : ""} enrolled
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <select
          aria-label={`Select teacher for ${cls.grade} ${cls.stream}`}
          value={selections[cls.id] ?? ""}
          onChange={(e) => onSelectionChange(cls.id, e.target.value as never)}
          className="text-[11px] bg-white/[0.05] border border-white/[0.1] rounded-lg py-2 pl-2.5 pr-7 text-white/80 focus:outline-none focus:border-amber-400/40 transition-colors"
        >
          <option value="" className="bg-[#0c0f1a]">Choose teacher…</option>
          {/* teachers prop is passed from parent via closure in render */}
        </select>

        <button
          onClick={() => onAssign(cls.id)}
          disabled={!hasSelection || isPending}
          className="bg-amber-400 hover:bg-amber-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-[#0c0f1a] px-3 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 shadow-lg shadow-amber-400/10"
        >
          Assign
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ClassTeacherClient({
  teachers,
  classes,
  assignments,
  studentCounts,
  academicYear,
}: Props) {
  const router = useRouter();

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    assignments.forEach((a) => { map[a.class_id] = a.teacher.id; });
    return map;
  });

  const [toast,     setToast]    = useState<ToastState | null>(null);
  const [isPending, startTransition] = useTransition();
  const [savingId,  setSavingId] = useState<string | null>(null);

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const handleSelectionChange = useCallback((classId: string, teacherId: string) => {
    setSelections((s) => ({ ...s, [classId]: teacherId }));
  }, []);

  function handleAssign(classId: string) {
    const teacherId = selections[classId];
    if (!teacherId) { showToast("Select a teacher first.", false); return; }
    setSavingId(classId);
    startTransition(async () => {
      const res = await assignClassTeacherAction({ classId, teacherId, academicYear });
      showToast(res.message, res.success);
      if (res.success) router.refresh();
      setSavingId(null);
    });
  }

  function handleRemove(assignmentId: string, grade: string) {
    startTransition(async () => {
      const res = await relieveClassTeacherAction(assignmentId);
      showToast(res.success ? `Relieved assignment for ${grade}.` : res.message, res.success);
      if (res.success) router.refresh();
    });
  }

  const assignedClassIds  = new Set(assignments.map((a) => a.class_id));
  const unassignedClasses = classes.filter((c) => !assignedClassIds.has(c.id));
  const coverage = classes.length > 0
    ? Math.round((assignments.length / classes.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">

      {/* Ambient glows — matching dashboard */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-60 left-1/4 w-[700px] h-[700px] rounded-full bg-amber-500/[0.04] blur-[140px]" />
        <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-500/[0.04] blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <header className="bg-[#0c0f1a]/80 backdrop-blur-md border-b border-white/[0.07] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <UserCheck className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                Kibali Academy
              </p>
              <h1 className="text-sm font-bold tracking-tight text-white">
                Class Teacher Management
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/classes"
              className="hidden sm:flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all duration-200 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#0c0f1a] shadow-lg shadow-amber-400/20"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Manage Classes
            </Link>
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1 text-xs font-semibold text-white/30 hover:text-white/70 transition-colors"
            >
              Back <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Toast ── */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 px-5 py-3 rounded-xl text-xs font-bold shadow-2xl animate-in slide-in-from-right ${
            toast.ok
              ? "bg-emerald-400/10 border border-emerald-400/30 text-emerald-400"
              : "bg-rose-500/10 border border-rose-500/30 text-rose-400"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Stats ── */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <p className="text-3xl font-black text-white">{classes.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-1">
              Total Active Classes
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.03] p-5">
            <p className="text-3xl font-black text-emerald-400">{assignments.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/50 mt-1">
              Teachers Assigned
            </p>
          </div>

          <div className={`rounded-2xl border p-5 ${
            unassignedClasses.length > 0
              ? "border-amber-400/20 bg-amber-400/[0.03]"
              : "border-white/[0.07] bg-white/[0.03]"
          }`}>
            <div className="flex items-baseline justify-between">
              <p className={`text-3xl font-black ${
                unassignedClasses.length > 0 ? "text-amber-400" : "text-white/40"
              }`}>
                {unassignedClasses.length}
              </p>
              <div className="flex items-center gap-1 text-white/20">
                <BarChart3 className="h-3.5 w-3.5" />
                <span className="text-[11px] font-mono font-bold">{coverage}%</span>
              </div>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-1">
              Pending Allocation
            </p>
          </div>
        </section>

        {/* ── Assigned classes ── */}
        {assignments.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25 px-1 flex items-center gap-2">
              <span className="inline-block w-1 h-1 rounded-full bg-emerald-400" />
              Allocated class personnel
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {assignments.map((a) => (
                <AssignedCard
                  key={a.id}
                  assignment={a}
                  teachers={teachers}
                  selections={selections}
                  onSelectionChange={handleSelectionChange}
                  onSave={handleAssign}
                  onRelieve={handleRemove}
                  isSaving={isPending && savingId === a.class_id}
                  isPending={isPending}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Unassigned classes ── */}
        {unassignedClasses.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400/70 flex items-center gap-2 px-1">
              <AlertCircle className="h-3 w-3" />
              Urgent: unassigned classes
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {unassignedClasses.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-dashed border-amber-400/20 bg-amber-400/[0.02] p-4 flex items-center gap-4 hover:border-amber-400/30 transition-colors"
                >
                  <div className="h-11 w-11 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-amber-400/70" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white">
                      {c.grade}
                      <span className="text-white/40 font-normal"> — </span>
                      {c.stream}
                    </h3>
                    {studentCounts[c.grade] !== undefined && (
                      <p className="text-[11px] text-white/30 mt-0.5">
                        {studentCounts[c.grade]} student{studentCounts[c.grade] !== 1 ? "s" : ""} enrolled
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      aria-label={`Select teacher for ${c.grade} ${c.stream}`}
                      value={selections[c.id] ?? ""}
                      onChange={(e) =>
                        setSelections((s) => ({ ...s, [c.id]: e.target.value }))
                      }
                      className="text-[11px] bg-white/[0.05] border border-white/[0.1] rounded-lg py-2 pl-2.5 pr-7 text-white/80 focus:outline-none focus:border-amber-400/40 transition-colors"
                    >
                      <option value="" className="bg-[#0c0f1a]">Choose teacher…</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id} className="bg-[#0c0f1a]">
                          {t.full_name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleAssign(c.id)}
                      disabled={!selections[c.id] || isPending}
                      className="bg-amber-400 hover:bg-amber-300 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed text-[#0c0f1a] px-3 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 shadow-lg shadow-amber-400/10"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── All-done banner ── */}
        {assignments.length > 0 && unassignedClasses.length === 0 && (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.03] px-6 py-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-emerald-400/10 flex items-center justify-center shrink-0">
              <UserCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-sm text-emerald-400/80 font-semibold">
              All {classes.length} classes have been assigned a class teacher for {academicYear}.
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {classes.length === 0 && (
          <div className="text-center py-20 text-white/20">
            <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-semibold">No classes found for {academicYear}</p>
            <Link
              href="/admin/classes"
              className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-400/60 hover:text-amber-400 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Create classes first
            </Link>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy · CBC School Management System · Academic Year {academicYear}
          </p>
        </footer>

      </main>
    </div>
  );
}