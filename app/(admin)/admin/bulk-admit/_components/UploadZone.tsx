"use client";

import { Upload, Download, FileSpreadsheet, Info } from "lucide-react";
import { useRef, useState } from "react";

interface UploadZoneProps {
  mode: "students" | "teachers";
  onFileUpload: (file: File) => void;
  onDownloadTemplate: () => void;
}

export function UploadZone({ mode, onFileUpload, onDownloadTemplate }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="relative group">
      {/* Background Ambient Glow */}
      <div className="absolute -inset-1 bg-gradient-to-r from-amber-400/20 to-emerald-400/20 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative border-2 border-dashed rounded-[2rem] p-12 text-center transition-all duration-300 backdrop-blur-sm
          ${isDragging 
            ? "border-amber-400 bg-amber-400/5 scale-[1.01]" 
            : "border-white/10 bg-[#0c0f1a]/80 hover:border-white/20"
          }`}
      >
        {/* Icon Header */}
        <div className="relative mx-auto w-20 h-20 mb-6">
          <div className="absolute inset-0 bg-amber-400/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all" />
          <div className="relative flex h-full w-full items-center justify-center rounded-3xl bg-[#161b2a] border border-white/10 shadow-2xl">
            <FileSpreadsheet className={`h-10 w-10 transition-colors ${isDragging ? "text-amber-400" : "text-amber-400/80"}`} />
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-[#0c0f1a] shadow-lg">
            <Upload className="h-4 w-4" />
          </div>
        </div>

        {/* Text Content */}
        <div className="space-y-2 mb-8">
          <h3 className="text-xl font-bold tracking-tight text-white">
            Upload {mode === "students" ? "Student" : "Teacher"} Records
          </h3>
          <p className="text-sm text-white/40 max-w-sm mx-auto leading-relaxed">
            Drag and drop your CSV file here, or use the buttons below to manage your data.
          </p>
        </div>

        {/* Actions */}
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

        {/* Hidden Input */}
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

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-white/[0.05] flex items-center justify-center gap-6">
          <div className="flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-amber-400/50" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">CSV Only</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-white/20" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Max 500 Rows</span>
          </div>
        </div>
      </div>
    </div>
  );
}