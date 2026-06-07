"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, GraduationCap, Users } from "lucide-react";
import { toast } from "sonner";

import { UploadZone } from "./_components/UploadZone";
import { BulkAdmitStudentEditor } from "./_components/BulkAdmitStudentEditor";
import { BulkAdmitTeacherEditor } from "./_components/BulkAdmitTeacherEditor";
import { BulkResultsPanel } from "./_components/BulkResultsPanel";

import type { BulkAdmitRow, BulkAdmitResult } from "@/lib/actions/bulk-admit";
import type {
  BulkStaffRow   as BulkTeacherRow,
  BulkStaffResult as BulkTeacherResult,
} from "@/lib/actions/bulk-teacher";
import { parseStudentCSV, parseTeacherCSV, getCSVTemplate } from "./utils";

import { bulkAdmitStudentsAction }              from "@/lib/actions/bulk-admit";
import { bulkAddStaffAction as bulkAddTeachersAction } from "@/lib/actions/bulk-teacher";

type Mode = "students" | "teachers";

// Mirrors ClassOption in types.ts — kept in sync with what fetchClasses returns
interface ClassItem {
  id:     string;
  grade:  string;
  stream: string;
}

interface BulkAdmitClientProps {
  classes: ClassItem[];
}

export function BulkAdmitClient({ classes }: BulkAdmitClientProps) {
  const [mode,    setMode]    = useState<Mode>("students");
  const [results, setResults] = useState<(BulkAdmitResult | BulkTeacherResult)[] | null>(null);
  const [summary, setSummary] = useState<{ success: number; failed: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  const firstGrade  = classes[0]?.grade  ?? "Grade 1";
  const firstStream = classes.find((c) => c.grade === firstGrade)?.stream ?? "Main";

  // ── Single source of truth ──────────────────────────────────────────────
  const [studentRows, setStudentRows] = useState<BulkAdmitRow[]>([
    {
      studentName:      "",
      dateOfBirth:      "",
      gender:           "Male",
      currentGrade:     firstGrade,
      stream:           firstStream,
      academicYear:     2026,
      upiNumber:        "",
      relationshipType: "guardian",
      parentMode:       "new",
      existingParentId: null,
      parentName:       "",
      parentEmail:      "",
      parentPhone:      "",
    },
  ]);

  const [teacherRows, setTeacherRows] = useState<BulkTeacherRow[]>([
    { fullName: "", email: "", phone: "", tscNumber: "" },
  ]);

  // ── CSV handlers ────────────────────────────────────────────────────────
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (mode === "students") {
        const parsed = parseStudentCSV(text);
        if (parsed.length > 0) {
          setStudentRows(parsed);
          toast.success(`Loaded ${parsed.length} student record${parsed.length !== 1 ? "s" : ""}`);
        } else {
          toast.error("No valid student rows found in file");
        }
      } else {
        const parsed = parseTeacherCSV(text);
        if (parsed.length > 0) {
          setTeacherRows(parsed);
          toast.success(`Loaded ${parsed.length} teacher record${parsed.length !== 1 ? "s" : ""}`);
        } else {
          toast.error("No valid teacher rows found in file");
        }
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv  = getCSVTemplate(mode);
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = mode === "students" ? "student_bulk_template.csv" : "teacher_bulk_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    setResults(null);
    setSummary(null);

    startTransition(async () => {
      if (mode === "students") {
        const validRows = studentRows.filter((r) => r.studentName.trim());
        if (validRows.length === 0) {
          toast.error("Please fill in at least one student name");
          return;
        }

        const res = await bulkAdmitStudentsAction(validRows);
        setResults(res.results);
        setSummary({ success: res.successCount, failed: res.failCount });

        if (res.failCount === 0) {
          toast.success(
            `Successfully admitted ${res.successCount} student${res.successCount !== 1 ? "s" : ""}!`
          );
        } else {
          toast(`Admitted ${res.successCount}, ${res.failCount} failed`, {
            description: "See results below for details",
          });
        }
      } else {
        const validRows = teacherRows.filter((r) => r.fullName.trim() && r.email.trim());
        if (validRows.length === 0) {
          toast.error("Please fill in at least one teacher name and email");
          return;
        }

        const res = await bulkAddTeachersAction(validRows);
        setResults(res.results);
        setSummary({ success: res.successCount, failed: res.failCount });

        if (res.failCount === 0) {
          toast.success(
            `Successfully added ${res.successCount} teacher${res.successCount !== 1 ? "s" : ""}!`
          );
        } else {
          toast(`Added ${res.successCount}, ${res.failCount} failed`);
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#0c0f1a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Bulk Admission</h1>
            <p className="text-white/40 text-sm mt-0.5">
              Import multiple students and staff efficiently
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="inline-flex bg-white/[0.04] border border-white/[0.07] rounded-2xl p-1 mb-8">
          <button
            onClick={() => setMode("students")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all text-sm ${
              mode === "students" ? "bg-amber-400 text-[#0c0f1a]" : "text-white/50 hover:text-white"
            }`}
          >
            <GraduationCap className="h-4.5 w-4.5" />
            Students
          </button>
          <button
            onClick={() => setMode("teachers")}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all text-sm ${
              mode === "teachers" ? "bg-amber-400 text-[#0c0f1a]" : "text-white/50 hover:text-white"
            }`}
          >
            <Users className="h-4.5 w-4.5" />
            Teachers
          </button>
        </div>

        {/* Upload zone — passes classes so the grade/stream reference table renders */}
        <UploadZone
          mode={mode}
          classes={mode === "students" ? classes : []}
          onFileUpload={handleFileUpload}
          onDownloadTemplate={downloadTemplate}
        />

        {/* Editor */}
        <div className="mt-8">
          {mode === "students" ? (
            <BulkAdmitStudentEditor
              classes={classes}
              rows={studentRows}
              setRows={setStudentRows}
              isPending={isPending}
              onSubmit={handleSubmit}
            />
          ) : (
            <BulkAdmitTeacherEditor
              rows={teacherRows}
              setRows={setTeacherRows}
              isPending={isPending}
              onSubmit={handleSubmit}
            />
          )}
        </div>

        {/* Results */}
        {results && summary && (
          <div className="mt-8">
            <BulkResultsPanel results={results} summary={summary} />
          </div>
        )}
      </div>
    </div>
  );
}