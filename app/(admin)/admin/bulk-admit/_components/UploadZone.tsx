"use client";

import { Upload, Download, FileSpreadsheet, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useRef, useState } from "react";
import Link from 'next/link'

// ClassOption matches what the page fetches and passes down
export interface ClassOption {
  id:     string;
  grade:  string;
  stream: string;
}

interface UploadZoneProps {
  mode:               "students" | "teachers";
  classes?:           ClassOption[]; // only relevant for students mode
  onFileUpload:       (file: File) => void;
  onDownloadTemplate: () => void;
}

export function UploadZone({
  mode,
  classes = [],
  onFileUpload,
  onDownloadTemplate,
}: UploadZoneProps) {
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const [isDragging,   setIsDragging]   = useState(false);
  const [showClasses,  setShowClasses]  = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileUpload(file);
  };

  // ── Derive unique grades → sorted streams for the reference table ──────
  // Preserves natural grade order from the classes array (server already sorts)
  const gradeMap = classes.reduce<Record<string, string[]>>((acc, c) => {
    if (!acc[c.grade]) acc[c.grade] = [];
    if (!acc[c.grade].includes(c.stream)) acc[c.grade].push(c.stream);
    return acc;
  }, {});

  const gradeEntries = Object.entries(gradeMap); // [grade, streams[]]
  const hasClasses   = gradeEntries.length > 0;

  return (
    <div className="relative group">
      {/* Ambient glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-amber-400/20 to-emerald-400/20 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200" />

      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        className={`relative border-2 border-dashed rounded-[2rem] p-10 text-center transition-all duration-300 backdrop-blur-sm ${
          isDragging
            ? "border-amber-400 bg-amber-400/5 scale-[1.01]"
            : "border-white/10 bg-[#0c0f1a]/80 hover:border-white/20"
        }`}
      >
        {/* Icon */}
        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="absolute inset-0 bg-amber-400/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all" />
          <div className="relative flex h-full w-full items-center justify-center rounded-3xl bg-[#161b2a] border border-white/10 shadow-2xl">
            <FileSpreadsheet
              className={`h-10 w-10 transition-colors ${
                isDragging ? "text-amber-400" : "text-amber-400/80"
              }`}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-[#0c0f1a] shadow-lg">
            <Upload className="h-4 w-4" />
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-2 mb-8">
          <h3 className="text-xl font-bold tracking-tight text-white">
            Upload {mode === "students" ? "Student" : "Teacher"} Records
          </h3>
          <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
            Drag and drop your CSV file here, or use the buttons below.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-white text-[#0c0f1a] px-8 py-3.5 rounded-2xl font-bold text-sm hover:bg-amber-400 transition-all active:scale-95 shadow-xl shadow-white/5"
          >
            <Upload className="h-4 w-4" />
            Browse Files
          </button>
          <button
            onClick={onDownloadTemplate}
            className="w-full sm:w-auto flex items-center justify-center gap-2 border border-white/10 bg-white/[0.03] text-white/70 px-8 py-3.5 rounded-2xl font-bold text-sm hover:bg-white/[0.08] hover:text-white transition-all active:scale-95"
          >
            <Download className="h-4 w-4" />
            Get Template
          </button>
        </div>

        {/* Hidden file input */}
        <input
          aria-label="upload bulk records"
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileUpload(file);
            e.target.value = "";
          }}
        />

        {/* ── Class reference (students mode only) ─────────────────────── */}
        {mode === "students" && (
          <div className="mt-8 pt-6 border-t border-white/[0.05] text-left">
            {hasClasses ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowClasses((p) => !p)}
                  className="flex items-center gap-2 mx-auto text-[11px] font-bold uppercase tracking-widest text-white/30 hover:text-white/50 transition-colors"
                >
                  <Info className="h-3.5 w-3.5 text-amber-400/50" />
                  Valid grades &amp; streams for CSV
                  {showClasses
                    ? <ChevronUp  className="h-3 w-3" />
                    : <ChevronDown className="h-3 w-3" />
                  }
                </button>

                {showClasses && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-white/[0.06]">
                          <th className="pb-2 pr-6 font-bold uppercase tracking-widest text-white/20 whitespace-nowrap">
                            Grade
                          </th>
                          <th className="pb-2 font-bold uppercase tracking-widest text-white/20">
                            Available Streams
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {gradeEntries.map(([grade, streams]) => (
                          <tr
                            key={grade}
                            className="border-b border-white/[0.03] last:border-0"
                          >
                            <td className="py-2 pr-6 text-amber-300/70 font-mono font-semibold whitespace-nowrap">
                              {grade}
                            </td>
                            <td className="py-2">
                              <div className="flex flex-wrap gap-1.5">
                                {streams.map((s) => (
                                  <span
                                    key={s}
                                    className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.07] text-white/40 font-mono"
                                  >
                                    {s}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 text-[10px] text-white/20 leading-relaxed">
                      Use these exact values in the <span className="font-mono text-white/30">Grade</span> and{" "}
                      <span className="font-mono text-white/30">Stream</span> columns of your CSV.
                      Rows referencing a grade/stream combination not listed here will fail.
                    </p>
                  </div>
                )}
              </>
            ) : (
              /* No classes set up yet */
              <div className="flex items-center justify-center gap-2 text-[11px] text-amber-400/50">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>
                  No classes found for this school year.{" "}
                  <Link
                    href="/admin/classes"
                    className="underline underline-offset-2 hover:text-amber-400 transition-colors"
                  >
                    Set up classes first
                  </Link>
                  {" "}before importing students.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer meta — teachers mode */}
        {mode === "teachers" && (
          <div className="mt-8 pt-6 border-t border-white/[0.05] flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-amber-400/50" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                CSV Only
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full bg-white/20" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">
                Max 500 Rows
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}