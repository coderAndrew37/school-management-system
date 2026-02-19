"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, BookOpen, ChevronDown } from "lucide-react";
import {
  createAllocationAction,
  deleteAllocationAction,
} from "@/lib/actions/allocation";
import {
  Subject,
  TeacherSubjectAllocation,
  CBC_GRADES,
  SubjectLevel,
} from "@/lib/types/allocation";

interface Teacher {
  id: string;
  full_name: string;
  email: string;
  tsc_number: string | null;
}

interface AllocationPanelProps {
  teachers: Teacher[];
  subjects: Subject[];
  allocations: TeacherSubjectAllocation[];
}

const LEVEL_LABELS: Record<SubjectLevel, string> = {
  lower_primary: "Lower Primary",
  upper_primary: "Upper Primary",
  junior_secondary: "Junior Secondary",
};

const LEVEL_COLORS: Record<SubjectLevel, string> = {
  lower_primary: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  upper_primary: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  junior_secondary: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function AllocationPanel({
  teachers,
  subjects,
  allocations,
}: AllocationPanelProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    teachers[0]?.id ?? "",
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  // Allocations for currently selected teacher
  const teacherAllocations = allocations.filter(
    (a) => a.teacher_id === selectedTeacherId,
  );

  // Grades available for the selected subject's level
  const gradeOptions: string[] = selectedSubject
    ? CBC_GRADES[selectedSubject.level]
    : [];

  // Group subjects by level for the dropdown
  const subjectsByLevel = subjects.reduce<Record<SubjectLevel, Subject[]>>(
    (acc, s) => {
      acc[s.level].push(s);
      return acc;
    },
    { lower_primary: [], upper_primary: [], junior_secondary: [] },
  );

  const handleAllocate = () => {
    if (!selectedTeacherId || !selectedSubjectId || !selectedGrade) {
      toast.warning("Please select a subject and grade before allocating.");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("teacherId", selectedTeacherId);
      fd.append("subjectId", selectedSubjectId);
      fd.append("grade", selectedGrade);
      fd.append("academicYear", "2026");

      const result = await createAllocationAction(fd);

      if (result.success) {
        toast.success("Allocation saved", { description: result.message });
        setSelectedSubjectId("");
        setSelectedGrade("");
      } else {
        toast.error("Allocation failed", { description: result.message });
      }
    });
  };

  const handleDelete = (allocationId: string, label: string) => {
    startTransition(async () => {
      const result = await deleteAllocationAction(allocationId);
      if (result.success) {
        toast.success("Allocation removed", { description: label });
      } else {
        toast.error("Failed to remove", { description: result.message });
      }
    });
  };

  const selectCls =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 focus:bg-white/8 disabled:opacity-50 cursor-pointer appearance-none";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* ── Left: Teacher list ── */}
      <div className="lg:col-span-2 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 px-1 mb-3">
          Select Teacher
        </p>
        <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
          {teachers.map((teacher) => {
            const isActive = teacher.id === selectedTeacherId;
            const count = allocations.filter(
              (a) => a.teacher_id === teacher.id,
            ).length;
            return (
              <button
                key={teacher.id}
                onClick={() => setSelectedTeacherId(teacher.id)}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-200 flex items-center gap-3 ${
                  isActive
                    ? "border-amber-400/40 bg-amber-400/10"
                    : "border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15"
                }`}
              >
                <div
                  className={`flex-shrink-0 h-9 w-9 rounded-lg flex items-center justify-center text-xs font-bold ${
                    isActive
                      ? "bg-amber-400 text-[#0c0f1a]"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {getInitials(teacher.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-semibold truncate ${isActive ? "text-white" : "text-white/70"}`}
                  >
                    {teacher.full_name}
                  </p>
                  {teacher.tsc_number && (
                    <p className="text-[10px] font-mono text-white/30 truncate">
                      {teacher.tsc_number}
                    </p>
                  )}
                </div>
                <span
                  className={`flex-shrink-0 text-[11px] font-bold rounded-md px-2 py-0.5 ${
                    isActive
                      ? "bg-amber-400/20 text-amber-400"
                      : "bg-white/5 text-white/30"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Right: allocation form + existing allocations ── */}
      <div className="lg:col-span-3 space-y-5">
        {/* Teacher header */}
        {selectedTeacher && (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] px-5 py-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-amber-400 flex items-center justify-center text-sm font-bold text-[#0c0f1a]">
              {getInitials(selectedTeacher.full_name)}
            </div>
            <div>
              <p className="font-bold text-white">
                {selectedTeacher.full_name}
              </p>
              <p className="text-xs text-white/40">{selectedTeacher.email}</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs text-white/30 uppercase tracking-wider">
                Subjects
              </p>
              <p className="text-2xl font-bold text-amber-400">
                {teacherAllocations.length}
              </p>
            </div>
          </div>
        )}

        {/* Assign form */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" /> Assign New Subject
          </p>

          {/* Subject select (grouped by level) */}
          <div className="relative">
            <select
              aria-label="select subject"
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedGrade("");
              }}
              className={selectCls}
              disabled={isPending}
            >
              <option value="" disabled className="bg-[#0c0f1a]">
                Choose a CBC subject…
              </option>
              {(
                Object.entries(subjectsByLevel) as [SubjectLevel, Subject[]][]
              ).map(([level, lvlSubjects]) =>
                lvlSubjects.length > 0 ? (
                  <optgroup
                    key={level}
                    label={LEVEL_LABELS[level]}
                    className="bg-[#0c0f1a] text-white/50"
                  >
                    {lvlSubjects.map((s) => (
                      <option
                        key={s.id}
                        value={s.id}
                        className="bg-[#0c0f1a] text-white"
                      >
                        {s.name} ({s.weekly_lessons}×/wk)
                      </option>
                    ))}
                  </optgroup>
                ) : null,
              )}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
          </div>

          {/* Grade select — only shown once subject is picked */}
          {selectedSubject && (
            <div className="space-y-2">
              <p className="text-[10px] text-white/35 uppercase tracking-wider">
                Level:{" "}
                <span
                  className={`font-semibold px-2 py-0.5 rounded border text-[10px] ${LEVEL_COLORS[selectedSubject.level]}`}
                >
                  {LEVEL_LABELS[selectedSubject.level]}
                </span>
              </p>
              <div className="relative">
                <select
                  aria-label="select grade"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className={selectCls}
                  disabled={isPending}
                >
                  <option value="" disabled className="bg-[#0c0f1a]">
                    Choose a grade…
                  </option>
                  {gradeOptions.map((g) => (
                    <option
                      key={g}
                      value={g}
                      className="bg-[#0c0f1a] text-white"
                    >
                      {g}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
              </div>
            </div>
          )}

          <button
            onClick={handleAllocate}
            disabled={isPending || !selectedSubjectId || !selectedGrade}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all duration-200 px-4 py-3 text-sm font-bold text-[#0c0f1a]"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Allocate Subject
          </button>
        </div>

        {/* Existing allocations list */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35 px-1">
            Current Allocations ({teacherAllocations.length})
          </p>

          {teacherAllocations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 py-8 text-center">
              <p className="text-white/25 text-sm">No subjects allocated yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {teacherAllocations.map((alloc) => {
                const level = alloc.subjects?.level ?? "upper_primary";
                return (
                  <div
                    key={alloc.id}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 group"
                  >
                    <span
                      className={`text-[10px] font-bold font-mono px-2 py-1 rounded border ${LEVEL_COLORS[level]}`}
                    >
                      {alloc.subjects?.code ?? "—"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {alloc.subjects?.name}
                      </p>
                      <p className="text-[11px] text-white/35">{alloc.grade}</p>
                    </div>
                    <button
                      onClick={() =>
                        handleDelete(
                          alloc.id,
                          `${alloc.subjects?.name} – ${alloc.grade}`,
                        )
                      }
                      disabled={isPending}
                      className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg p-1.5 hover:bg-rose-500/20 text-rose-400 disabled:cursor-not-allowed"
                      title="Remove allocation"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
