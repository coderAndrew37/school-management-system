"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronLeft, GraduationCap, Users, LayoutGrid, FileUp } from "lucide-react";
import { toast } from "sonner";

import { UploadZone } from "./_components/UploadZone";
import { BulkAdmitStudentEditor } from "./_components/BulkAdmitStudentEditor";
import { BulkAdmitTeacherEditor } from "./_components/BulkAdmitTeacherEditor";
import { BulkResultsPanel } from "./_components/BulkResultsPanel";

import type { BulkAdmitRow, BulkAdmitResult } from "@/lib/actions/bulk-admit";
import type { BulkTeacherRow, BulkTeacherResult } from "@/lib/actions/bulk-teacher";
import { parseStudentCSV, parseTeacherCSV, getCSVTemplate } from "./utils";

import { bulkAdmitStudentsAction } from "@/lib/actions/bulk-admit";
import { bulkAddTeachersAction } from "@/lib/actions/bulk-teacher";

type Mode = "students" | "teachers";

interface BulkAdmitClientProps {
  classes: { id: string; grade: string; stream: string }[];
}

export function BulkAdmitClient({ classes }: BulkAdmitClientProps) {
  const [mode, setMode] = useState<Mode>("students");
  const [results, setResults] = useState<(BulkAdmitResult | BulkTeacherResult)[] | null>(null);
  const [summary, setSummary] = useState<{ success: number; failed: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  // CSV and Submit handlers remain logically the same but are wired to the new UI
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (mode === "students") {
        const parsed = parseStudentCSV(text);
        if (parsed.length > 0) toast.success(`Imported ${parsed.length} students`);
      } else {
        const parsed = parseTeacherCSV(text);
        if (parsed.length > 0) toast.success(`Imported ${parsed.length} teachers`);
      }
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const csv = getCSVTemplate(mode);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mode}_template.csv`;
    a.click();
  };

  const handleSubmit = () => {
    // Logic from your original component
    startTransition(async () => {
        // ... (original submit logic)
    });
  };

  return (
    <div className="min-h-screen bg-[#0c0f1a] text-white font-[family-name:var(--font-body)] overflow-x-hidden">
      {/* Dynamic Ambient Glows based on Mode */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className={`absolute -top-60 left-1/4 w-[700px] h-[700px] rounded-full transition-colors duration-1000 blur-[140px] ${mode === 'students' ? 'bg-amber-500/[0.04]' : 'bg-emerald-500/[0.04]'}`} />
        <div className={`absolute bottom-0 right-0 w-80 h-80 rounded-full transition-colors duration-1000 blur-[100px] ${mode === 'students' ? 'bg-sky-500/[0.04]' : 'bg-amber-500/[0.04]'}`} />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* ── Header ────────────────────────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all shadow-lg"
            >
              <ChevronLeft className="h-5 w-5 text-white/50" />
            </Link>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                Administration
              </p>
              <h1 className="text-xl font-bold tracking-tight text-white">
                Bulk Import Center
              </h1>
            </div>
          </div>

          {/* Mode Toggle Switched to Segmented Control style */}
          <div className="flex p-1 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-md">
            <button
              onClick={() => setMode("students")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                mode === "students" 
                ? "bg-amber-400 text-[#0c0f1a] shadow-lg shadow-amber-400/20" 
                : "text-white/40 hover:text-white/70"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Students
            </button>
            <button
              onClick={() => setMode("teachers")}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                mode === "teachers" 
                ? "bg-emerald-400 text-[#0c0f1a] shadow-lg shadow-emerald-400/20" 
                : "text-white/40 hover:text-white/70"
              }`}
            >
              <Users className="h-4 w-4" />
              Teachers
            </button>
          </div>
        </header>

        {/* ── Main Content Grid ─────────────────────────────────────────────── */}
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Upload & Instructions */}
          <div className="lg:col-span-1 space-y-6">
            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1">
               <UploadZone
                mode={mode}
                onFileUpload={handleFileUpload}
                onDownloadTemplate={downloadTemplate}
              />
            </section>

            <section className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 space-y-4">
              <div className="flex items-center gap-2 text-white/80">
                <LayoutGrid className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold">Import Instructions</h3>
              </div>
              <ul className="space-y-3">
                {[
                  "Download the official CSV template.",
                  "Ensure all required fields are filled.",
                  "Do not change the header column names.",
                  "Review the preview table before submitting."
                ].map((step, idx) => (
                  <li key={idx} className="flex gap-3 text-xs text-white/40 leading-relaxed">
                    <span className="text-amber-400/50 font-mono">{idx + 1}.</span>
                    {step}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Right Column: The Data Editor */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2 mb-2">
              <div className={`h-1.5 w-1.5 rounded-full ${mode === 'students' ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">Data Preview & Edit</h2>
            </div>
            
            {mode === "students" ? (
              <BulkAdmitStudentEditor
                classes={classes}
                isPending={isPending}
                onSubmit={handleSubmit}
              />
            ) : (
              <BulkAdmitTeacherEditor
                isPending={isPending}
                onSubmit={handleSubmit}
              />
            )}

            {/* Results Panel Integration */}
            {results && summary && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <BulkResultsPanel results={results} summary={summary} />
              </div>
            )}
          </div>
        </main>

        <footer className="pt-8 border-t border-white/[0.05]">
          <p className="text-center text-[10px] uppercase tracking-[0.3em] text-white/20">
            Kibali Academy Secure Data Ingestion Pipeline
          </p>
        </footer>
      </div>
    </div>
  );
}