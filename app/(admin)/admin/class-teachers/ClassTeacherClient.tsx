"use client";

import { useState, useTransition } from "react";
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
  LayoutGrid,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

interface DbClass {
  id: string;
  grade: string;
  stream: string;
}

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  tsc_number: string | null;
}

interface Assignment {
  id: string;
  class_id: string;
  academic_year: number;
  classes: { grade: string; stream: string } | any;
  teachers: { id: string; full_name: string; email: string } | any;
}

interface Props {
  teachers: Teacher[];
  classes: DbClass[];
  assignments: any[];
  studentCounts: Record<string, number>;
  academicYear: number;
}

export function ClassTeacherClient({
  teachers,
  classes,
  assignments,
  studentCounts,
  academicYear,
}: Props) {
  const [localAssignments, setLocalAssignments] =
    useState<Assignment[]>(assignments);
  const [selections, setSelections] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    assignments.forEach((a) => {
      const tId = Array.isArray(a.teachers)
        ? a.teachers[0]?.id
        : a.teachers?.id;
      if (tId) map[a.class_id] = tId;
    });
    return map;
  });

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  }

  function handleAssign(classId: string) {
    const teacherId = selections[classId];
    if (!teacherId) {
      showToast("Select a teacher first.", false);
      return;
    }

    setSavingId(classId);
    startTransition(async () => {
      const res = await assignClassTeacherAction({
        classId, // This is now a guaranteed UUID from the classes table
        teacherId,
        academicYear,
      });

      if (res.success) {
        showToast(res.message, true);
        // Using window.location.reload to ensure the complex joins from Supabase stay in sync
        setTimeout(() => window.location.reload(), 500);
      } else {
        showToast(res.message, false);
      }
      setSavingId(null);
    });
  }

  function handleRemove(assignmentId: string, gradeName: string) {
    startTransition(async () => {
      const res = await relieveClassTeacherAction(assignmentId);
      if (res.success) {
        showToast(`Relieved assignment for ${gradeName}.`, true);
        setTimeout(() => window.location.reload(), 500);
      } else {
        showToast(res.message, false);
      }
    });
  }

  const assignedClassIds = new Set(localAssignments.map((a) => a.class_id));
  const unassignedClasses = classes.filter((c) => !assignedClassIds.has(c.id));

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200">
      <header className="bg-[#1e293b]/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 p-2 rounded-lg">
              <UserCheck className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white tracking-tight">
                Class Teacher Management
              </h1>
              <p className="text-[10px] text-slate-400 font-medium uppercase">
                Session {academicYear}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/admin/classes"
              className="hidden sm:flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Manage Classes
            </Link>
            <Link
              href="/admin/dashboard"
              className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1"
            >
              Back <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      {toast && (
        <div
          className={`fixed top-20 right-4 z-50 px-5 py-3 rounded-xl text-xs font-bold shadow-2xl animate-in slide-in-from-right ${
            toast.ok ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1e293b] rounded-2xl border border-slate-800 p-5">
            <p className="text-3xl font-black text-white">{classes.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
              Total Active Classes
            </p>
          </div>
          <div className="bg-[#1e293b] rounded-2xl border border-blue-500/30 p-5">
            <p className="text-3xl font-black text-blue-400">
              {localAssignments.length}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mt-1">
              Teachers Assigned
            </p>
          </div>
          <div
            className={`rounded-2xl border p-5 ${unassignedClasses.length > 0 ? "bg-amber-500/5 border-amber-500/20" : "bg-[#1e293b] border-slate-800"}`}
          >
            <p
              className={`text-3xl font-black ${unassignedClasses.length > 0 ? "text-amber-500" : "text-slate-400"}`}
            >
              {unassignedClasses.length}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-1">
              Pending Allocation
            </p>
          </div>
        </div>

        {/* Assigned */}
        <div className="space-y-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-1">
            Allocated Class Personnel
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {localAssignments.map((a) => (
              <div
                key={a.id}
                className="bg-[#1e293b] rounded-2xl border border-slate-800 p-4 flex items-center gap-4"
              >
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                  <GraduationCap className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {a.classes?.grade} - {a.classes?.stream}
                  </h3>
                  <p className="text-xs font-semibold text-blue-400 truncate">
                    {a.teachers?.full_name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selections[a.class_id] ?? ""}
                    onChange={(e) =>
                      setSelections((s) => ({
                        ...s,
                        [a.class_id]: e.target.value,
                      }))
                    }
                    aria-label="Select teacher"
                    className="text-[11px] bg-[#0f172a] border border-slate-700 rounded-lg py-2 pl-2 pr-8 text-slate-300"
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name}
                      </option>
                    ))}
                  </select>
                  <button
                    aria-label="Assign class to a teacher"
                    onClick={() => handleAssign(a.class_id)}
                    disabled={isPending && savingId === a.class_id}
                    className="p-2.5 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white"
                  >
                    <Save className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="remove class assignment"
                    onClick={() => handleRemove(a.id, a.classes?.grade)}
                    disabled={isPending}
                    className="p-2.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Unassigned */}
        {unassignedClasses.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 flex items-center gap-2 px-1">
              <AlertCircle className="h-3 w-3" /> Urgent: Unassigned Classes
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {unassignedClasses.map((c) => (
                <div
                  key={c.id}
                  className="bg-[#1e293b] rounded-2xl border border-dashed border-amber-500/30 p-4 flex items-center gap-4"
                >
                  <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-white">
                      {c.grade} - {c.stream}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="select grade"
                      value={selections[c.id] ?? ""}
                      onChange={(e) =>
                        setSelections((s) => ({ ...s, [c.id]: e.target.value }))
                      }
                      className="text-[11px] bg-[#0f172a] border border-slate-700 rounded-lg py-2 px-2 text-slate-300"
                    >
                      <option value="">Choose Teacher</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAssign(c.id)}
                      disabled={!selections[c.id] || isPending}
                      className="bg-amber-500 hover:bg-amber-400 text-white px-3 py-2 rounded-lg text-[11px] font-bold"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
