"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, BookOpen, ChevronDown, User } from "lucide-react";
import {
  createAllocationAction,
  deleteAllocationAction,
} from "@/lib/actions/allocation";
import {
  Subject,
  TeacherSubjectAllocation,
  SubjectLevel,
  Class,
  formatClassName,
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
  classes: Class[];
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
  classes,
}: AllocationPanelProps) {
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>(
    teachers[0]?.id ?? "",
  );
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const selectedTeacher = teachers.find((t) => t.id === selectedTeacherId);
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  const filteredClasses = classes.filter(
    (c) => c.level === selectedSubject?.level,
  );

  const teacherAllocations = allocations.filter(
    (a) => a.teacher_id === selectedTeacherId,
  );

  const subjectsByLevel = subjects.reduce<Record<SubjectLevel, Subject[]>>(
    (acc, s) => {
      acc[s.level].push(s);
      return acc;
    },
    { lower_primary: [], upper_primary: [], junior_secondary: [] },
  );

  const handleAllocate = () => {
    if (!selectedTeacherId || !selectedSubjectId || !selectedClassId) {
      toast.warning("Incomplete Selection", { 
        description: "Please select both a subject and a class." 
      });
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("teacherId", selectedTeacherId);
      fd.append("subjectId", selectedSubjectId);
      fd.append("classId", selectedClassId);
      fd.append("academicYear", "2026");

      const result = await createAllocationAction(fd);

      if (result.success) {
        toast.success("Allocation Saved", { description: result.message });
        setSelectedSubjectId("");
        setSelectedClassId("");
      } else {
        toast.error("Allocation Failed", { description: result.message });
      }
    });
  };

  const handleDelete = (allocationId: string, label: string) => {
    startTransition(async () => {
      const result = await deleteAllocationAction(allocationId);
      if (result.success) {
        toast.success("Allocation Removed", { description: label });
      } else {
        toast.error("Removal Failed", { description: result.message });
      }
    });
  };

  const selectCls =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-all focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 focus:bg-white/8 disabled:opacity-50 cursor-pointer appearance-none shadow-sm";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Teacher Selection Column */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between px-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
            Select Faculty
          </p>
          <span className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-full border border-white/5">
            {teachers.length} Staff
          </span>
        </div>
        
        <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {teachers.map((teacher) => {
            const isActive = teacher.id === selectedTeacherId;
            const count = allocations.filter(
              (a) => a.teacher_id === teacher.id,
            ).length;
            return (
              <button
                key={teacher.id}
                onClick={() => setSelectedTeacherId(teacher.id)}
                className={`w-full text-left rounded-2xl border p-4 transition-all duration-300 flex items-center gap-4 group ${
                  isActive
                    ? "border-amber-400/40 bg-amber-400/5 shadow-lg shadow-amber-400/5"
                    : "border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10"
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-xl flex items-center justify-center text-xs font-black transition-colors ${
                    isActive 
                      ? "bg-amber-400 text-black shadow-inner" 
                      : "bg-white/5 text-white/40 group-hover:text-white/60"
                  }`}
                >
                  {getInitials(teacher.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold truncate ${isActive ? "text-white" : "text-white/60"}`}>
                    {teacher.full_name}
                  </p>
                  <p className="text-[10px] text-white/20 font-mono uppercase tracking-tight mt-0.5">
                    TSC: {teacher.tsc_number ?? "N/A"}
                  </p>
                </div>
                <div className={`h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-black ${
                  isActive ? "bg-amber-400/20 text-amber-400" : "bg-white/5 text-white/20"
                }`}>
                  {count}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Allocation Configuration Column */}
      <div className="lg:col-span-3 space-y-6">
        {selectedTeacher && (
          <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-white/[0.04] to-transparent p-6 flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-amber-400 flex items-center justify-center text-lg font-black text-black shadow-xl shadow-amber-400/20">
              {getInitials(selectedTeacher.full_name)}
            </div>
            <div>
              <p className="text-lg font-black text-white tracking-tight">
                {selectedTeacher.full_name}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-xs text-white/40">{selectedTeacher.email}</p>
                <div className="h-1 w-1 rounded-full bg-white/10" />
                <span className="text-[10px] font-bold text-amber-400/60 uppercase tracking-widest">Active Faculty</span>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-amber-400/70" />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
              New Workload Allocation
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">Select Subject</label>
              <div className="relative">
                <select
                  aria-label="select subject id"
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setSelectedClassId("");
                  }}
                  className={selectCls}
                  disabled={isPending}
                >
                  <option value="" disabled>Choose a CBC subject...</option>
                  {(Object.entries(subjectsByLevel) as [SubjectLevel, Subject[]][]).map(
                    ([level, lvlSubjects]) => lvlSubjects.length > 0 && (
                      <optgroup key={level} label={LEVEL_LABELS[level]} className="bg-[#0c0f1a] text-white/50">
                        {lvlSubjects.map((s) => (
                          <option key={s.id} value={s.id} className="text-white">
                            {s.name} ({s.weekly_lessons}×/wk)
                          </option>
                        ))}
                      </optgroup>
                    )
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
              </div>
            </div>

            {selectedSubject && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest px-1">
                  <span>Category:</span>
                  <span className={`font-black px-2 py-0.5 rounded-md border ${LEVEL_COLORS[selectedSubject.level]}`}>
                    {LEVEL_LABELS[selectedSubject.level]}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-white/20 uppercase tracking-widest ml-1">Target Class</label>
                  <div className="relative">
                    <select
                      aria-label="select class id"
                      value={selectedClassId}
                      onChange={(e) => setSelectedClassId(e.target.value)}
                      className={selectCls}
                      disabled={isPending}
                    >
                      <option value="" disabled>Select a specific Stream...</option>
                      {filteredClasses.map((cls) => (
                        <option key={cls.id} value={cls.id} className="text-white">
                          {formatClassName(cls)}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleAllocate}
              disabled={isPending || !selectedSubjectId || !selectedClassId}
              className="group flex items-center justify-center gap-3 w-full rounded-2xl bg-amber-400 hover:bg-amber-300 disabled:opacity-20 px-4 py-4 text-sm font-black text-black transition-all shadow-xl shadow-amber-400/10 active:scale-[0.98]"
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform duration-300" />
              )}
              COMPLETE ALLOCATION
            </button>
          </div>
        </div>

        {/* Existing Workload View */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
              Allocated Workload ({teacherAllocations.length})
            </p>
          </div>

          {teacherAllocations.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-white/5 py-12 text-center bg-white/[0.01]">
              <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                <User className="h-6 w-6 text-white/10" />
              </div>
              <p className="text-white/20 text-xs font-medium uppercase tracking-widest">Zero workload assigned</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {teacherAllocations.map((alloc) => (
                <div
                  key={alloc.id}
                  className="flex items-center gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4 group transition-all hover:bg-white/[0.05] hover:border-white/10"
                >
                  <div className={`text-[10px] font-black font-mono w-12 text-center py-2 rounded-lg border ${LEVEL_COLORS[alloc.subjects?.level ?? "upper_primary"]}`}>
                    {alloc.subjects?.code ?? "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate group-hover:text-amber-400 transition-colors">
                      {alloc.subjects?.name}
                    </p>
                    <p className="text-[10px] text-white/30 font-medium mt-0.5">
                      {formatClassName(alloc.classes)}
                    </p>
                  </div>
                  <button
                    aria-label={`remove allocation for ${alloc.subjects?.name}`}
                    onClick={() => handleDelete(alloc.id, `${alloc.subjects?.name}`)}
                    disabled={isPending}
                    className="opacity-0 group-hover:opacity-100 h-8 w-8 rounded-lg flex items-center justify-center bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-200"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}