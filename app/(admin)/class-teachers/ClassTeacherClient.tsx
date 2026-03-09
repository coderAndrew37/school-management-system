"use client";

import { useState, useTransition } from "react";
import {
  assignClassTeacherAction,
  removeClassTeacherAction,
} from "@/lib/actions/class-teacher";
import {
  Users,
  UserCheck,
  Trash2,
  Save,
  ChevronRight,
  GraduationCap,
} from "lucide-react";

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  tsc_number: string | null;
}

interface Assignment {
  id: string;
  grade: string;
  academic_year: number;
  created_at: string;
  // This now correctly reflects the Supabase join structure (array or object)
  teachers:
    | { id: string; full_name: string; email: string }
    | { id: string; full_name: string; email: string }[]
    | null;
}

interface Props {
  teachers: Teacher[];
  grades: string[];
  assignments: Assignment[];
  studentCounts: Record<string, number>;
}

export function ClassTeacherClient({
  teachers,
  grades,
  assignments,
  studentCounts,
}: Props) {
  const [localAssignments, setLocalAssignments] =
    useState<Assignment[]>(assignments);

  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const a of assignments) {
      // Logic to handle both array and object formats during initialization
      const teacherObj = Array.isArray(a.teachers) ? a.teachers[0] : a.teachers;
      if (teacherObj) map[a.grade] = teacherObj.id;
    }
    return map;
  });

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [savingGrade, setSavingGrade] = useState<string | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function handleAssign(grade: string) {
    const teacherId = selections[grade];
    if (!teacherId) {
      showToast("Select a teacher first.", false);
      return;
    }
    setSavingGrade(grade);
    startTransition(async () => {
      const res = await assignClassTeacherAction({
        grade,
        teacherId,
        academicYear: 2026,
      });
      if (res.success) {
        const teacher = teachers.find((t) => t.id === teacherId)!;
        setLocalAssignments((prev) => {
          const without = prev.filter((a) => a.grade !== grade);
          return [
            ...without,
            {
              id: `temp-${Date.now()}`,
              grade,
              academic_year: 2026,
              created_at: new Date().toISOString(),
              teachers: {
                id: teacher.id,
                full_name: teacher.full_name,
                email: teacher.email,
              },
            },
          ].sort((a, b) => a.grade.localeCompare(b.grade));
        });
        showToast(res.message, true);
      } else {
        showToast(res.message, false);
      }
      setSavingGrade(null);
    });
  }

  function handleRemove(assignment: Assignment) {
    startTransition(async () => {
      const res = await removeClassTeacherAction(assignment.id);
      if (res.success) {
        setLocalAssignments((prev) =>
          prev.filter((a) => a.id !== assignment.id),
        );
        setSelections((prev) => {
          const n = { ...prev };
          delete n[assignment.grade];
          return n;
        });
        showToast(`Removed assignment for ${assignment.grade}.`, true);
      } else {
        showToast(res.message, false);
      }
    });
  }

  const assignedGrades = new Set(localAssignments.map((a) => a.grade));
  const unassignedGrades = grades.filter((g) => !assignedGrades.has(g));

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <UserCheck className="h-5 w-5 text-blue-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-black text-slate-800">
              Class Teacher Assignments
            </p>
            <p className="text-[10px] text-slate-400 font-semibold">
              Academic Year 2026
            </p>
          </div>
          <a
            href="/admin"
            className="text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            Admin <ChevronRight className="h-3 w-3" />
          </a>
        </div>
      </header>

      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-bold shadow-xl transition-all ${
            toast.ok ? "bg-emerald-600 text-white" : "bg-rose-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center">
            <p className="text-2xl font-black text-slate-800">
              {grades.length}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">
              Total Classes
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm text-center">
            <p className="text-2xl font-black text-emerald-700">
              {localAssignments.length}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mt-0.5">
              Assigned
            </p>
          </div>
          <div
            className={`rounded-2xl border p-4 shadow-sm text-center ${unassignedGrades.length > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200"}`}
          >
            <p
              className={`text-2xl font-black ${unassignedGrades.length > 0 ? "text-amber-700" : "text-slate-400"}`}
            >
              {unassignedGrades.length}
            </p>
            <p
              className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 ${unassignedGrades.length > 0 ? "text-amber-500" : "text-slate-400"}`}
            >
              Unassigned
            </p>
          </div>
        </div>

        {localAssignments.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
              Current Assignments
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {localAssignments.map((a) => {
                // Flatten the teacher object here for use in the TSX
                const teacherData = Array.isArray(a.teachers)
                  ? a.teachers[0]
                  : a.teachers;

                return (
                  <div
                    key={a.id}
                    className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm flex items-center gap-3"
                  >
                    <div className="h-11 w-11 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                      <GraduationCap className="h-5 w-5 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800">
                        {a.grade}
                      </p>
                      <p className="text-xs font-bold text-emerald-700">
                        {teacherData?.full_name ?? "—"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {studentCounts[a.grade] ?? 0} students
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        aria-label="select class teacher for grade"
                        value={selections[a.grade] ?? teacherData?.id ?? ""}
                        onChange={(e) =>
                          setSelections((s) => ({
                            ...s,
                            [a.grade]: e.target.value,
                          }))
                        }
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-300 max-w-[140px]"
                      >
                        <option value="">— change —</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleAssign(a.grade)}
                        disabled={isPending && savingGrade === a.grade}
                        className="h-8 w-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
                        title="Save"
                      >
                        <Save className="h-3.5 w-3.5" />
                      </button>

                      <button
                        onClick={() => handleRemove(a)}
                        disabled={isPending}
                        className="h-8 w-8 rounded-lg border border-rose-200 text-rose-400 flex items-center justify-center hover:bg-rose-50 disabled:opacity-50 transition-colors shrink-0"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {unassignedGrades.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 px-1 flex items-center gap-2">
              <span>⚠️</span> Unassigned Classes
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {unassignedGrades.map((grade) => (
                <div
                  key={grade}
                  className="bg-white rounded-2xl border border-amber-200 p-4 shadow-sm flex items-center gap-3"
                >
                  <div className="h-11 w-11 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Users className="h-5 w-5 text-amber-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-800">{grade}</p>
                    <p className="text-[10px] text-slate-400">
                      {studentCounts[grade] ?? 0} students · No class teacher
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      aria-label="select grade"
                      value={selections[grade] ?? ""}
                      onChange={(e) =>
                        setSelections((s) => ({
                          ...s,
                          [grade]: e.target.value,
                        }))
                      }
                      className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-300 max-w-[150px]"
                    >
                      <option value="">— assign teacher —</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleAssign(grade)}
                      disabled={
                        (isPending && savingGrade === grade) ||
                        !selections[grade]
                      }
                      className="h-8 px-3 rounded-lg bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-amber-600 disabled:opacity-40 transition-colors shrink-0"
                    >
                      <Save className="h-3 w-3" />
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {grades.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
            <p className="text-4xl mb-3">🏫</p>
            <p className="text-slate-700 font-bold">No classes found</p>
            <p className="text-xs text-slate-400 mt-1">
              Enrol students first to see classes here.
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <p className="text-xs font-bold text-blue-700 mb-1">
            About class teacher assignments
          </p>
          <p className="text-xs text-blue-600 leading-relaxed">
            A class teacher is responsible for marking daily attendance for
            their whole class, aggregating subject teacher remarks into
            end-of-term reports, and sending class-wide communications. Subject
            teachers can still mark attendance for students in their allocated
            subjects — the class teacher has additional whole-class access.
          </p>
        </div>
      </div>
    </div>
  );
}
