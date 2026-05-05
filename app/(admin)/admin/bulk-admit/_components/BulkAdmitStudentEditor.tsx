"use client";

import type { BulkAdmitRow } from "@/lib/actions/bulk-admit";
import { Plus, Save, Trash2, GraduationCap } from "lucide-react";
import { useState, useMemo } from "react";

interface Props {
  // Received from the Parent Server Component
  classes: { id: string; grade: string; stream: string }[];
  isPending: boolean;
  onSubmit: (rows: BulkAdmitRow[]) => void;
}

export function BulkAdmitStudentEditor({ classes, isPending, onSubmit }: Props) {
  // 1. Logic to get unique grades from the database classes
  const availableGrades = useMemo(() => {
    return Array.from(new Set(classes.map((c) => c.grade))).sort();
  }, [classes]);

  const [rows, setRows] = useState<BulkAdmitRow[]>([
    {
      studentName: "",
      dateOfBirth: "",
      gender: "Male",
      currentGrade: availableGrades[0] || "",
      stream: classes.find(c => c.grade === availableGrades[0])?.stream || "Main",
      parentName: "",
      parentEmail: "",
      parentPhone: "",
      academicYear: 2026,
    },
  ]);

  const addRow = () => {
    const firstGrade = availableGrades[0] || "";
    const firstStream = classes.find(c => c.grade === firstGrade)?.stream || "Main";
    
    setRows((prev) => [
      ...prev,
      { ...prev[0], studentName: "", parentName: "", parentEmail: "", parentPhone: "", currentGrade: firstGrade, stream: firstStream },
    ]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateRow = (index: number, field: keyof BulkAdmitRow, value: string) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        
        // If grade changes, reset stream to the first available one for that grade
        if (field === "currentGrade") {
          const firstAvailableStream = classes.find(c => c.grade === value)?.stream || "";
          return { ...row, [field]: value, stream: firstAvailableStream };
        }
        
        return { ...row, [field]: value };
      })
    );
  };

  return (
    <div className="relative space-y-6">
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-amber-500/[0.05] blur-[100px] -z-10" />

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Batch Entry <span className="text-amber-400 font-mono text-sm">({rows.length})</span>
          </h2>
          <p className="text-xs text-white/40 mt-1">Admission for Academic Year 2026</p>
        </div>
        <button
          onClick={addRow}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-white/70 hover:text-amber-400 hover:border-amber-400/30 transition-all text-xs font-bold uppercase tracking-wider"
        >
          <Plus className="h-4 w-4" /> Add Student
        </button>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] border-collapse">
            <thead>
              <tr className="border-b border-white/[0.07] bg-white/[0.03]">
                <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-white/30 w-12">#</th>
                <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-white/30">Student Details</th>
                <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-white/30">Class Placement</th>
                <th className="px-4 py-4 text-left text-[10px] font-bold uppercase tracking-widest text-white/30">Parent Information</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {rows.map((row, i) => (
                <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-4 text-white/20 font-mono text-xs align-top pt-7">{i + 1}</td>

                  <td className="px-4 py-4 space-y-2">
                    <input
                      type="text"
                      placeholder="Student Full Name"
                      value={row.studentName}
                      onChange={(e) => updateRow(i, "studentName", e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-amber-400/50 transition-colors"
                    />
                    <div className="flex gap-2">
                      <input
                        type="date"
                        aria-label="date of birth"
                        value={row.dateOfBirth}
                        onChange={(e) => updateRow(i, "dateOfBirth", e.target.value)}
                        className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none"
                      />
                      <select
                        aria-label="select gender"
                        value={row.gender}
                        onChange={(e) => updateRow(i, "gender", e.target.value)}
                        className="bg-[#0c0f1a] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                      </select>
                    </div>
                  </td>

                  <td className="px-4 py-4 space-y-2">
                    <div className="flex items-center gap-2 text-white/30 mb-1">
                       <GraduationCap className="h-3 w-3" />
                       <span className="text-[10px] uppercase font-bold">Select Class</span>
                    </div>
                    <select
                      aria-label="current grade"
                      value={row.currentGrade}
                      onChange={(e) => updateRow(i, "currentGrade", e.target.value)}
                      className="w-full bg-[#0c0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    >
                      {availableGrades.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    
                    {/* Dynamic Stream Selection based on chosen Grade */}
                    <select
                      aria-label="select stream"
                      value={row.stream}
                      onChange={(e) => updateRow(i, "stream", e.target.value)}
                      className="w-full bg-[#0c0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none"
                    >
                      {classes
                        .filter((c) => c.grade === row.currentGrade)
                        .map((c) => (
                          <option key={c.id} value={c.stream}>
                            {c.stream} Stream
                          </option>
                        ))}
                    </select>
                  </td>

                  <td className="px-4 py-4 space-y-2">
                    <input
                      type="text"
                      placeholder="Parent Name"
                      value={row.parentName}
                      onChange={(e) => updateRow(i, "parentName", e.target.value)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <input
                        type="email"
                        placeholder="Email"
                        value={row.parentEmail}
                        onChange={(e) => updateRow(i, "parentEmail", e.target.value)}
                        className="flex-1 bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none"
                      />
                      <input
                        type="tel"
                        placeholder="Phone"
                        value={row.parentPhone}
                        onChange={(e) => updateRow(i, "parentPhone", e.target.value)}
                        className="w-32 bg-white/[0.03] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none"
                      />
                    </div>
                  </td>

                  <td className="px-4 py-4 text-right align-top pt-7">
                    <button
                      aria-label="remove row"
                      onClick={() => removeRow(i)}
                      className="p-2 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-400/10 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-6 bg-white/[0.03] border-t border-white/[0.07] flex items-center justify-between">
          <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium">
            Confirming admission for {rows.length} students
          </p>
          <button
            onClick={() => onSubmit(rows)}
            disabled={isPending}
            className="group flex items-center gap-2 bg-amber-400 disabled:bg-white/10 text-[#0c0f1a] font-bold px-8 py-3 rounded-xl hover:bg-amber-300 active:scale-95 transition-all shadow-lg shadow-amber-400/10 disabled:text-white/20"
          >
            <Save className="h-4 w-4" />
            {isPending ? "Processing..." : "Confirm Bulk Admission"}
          </button>
        </div>
      </div>
    </div>
  );
}