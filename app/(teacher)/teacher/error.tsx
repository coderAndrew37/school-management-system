"use client";

// app/(teachers)/error.tsx

import { useEffect } from "react";
import { GraduationCap, AlertCircle, RefreshCw, BookOpen } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TeacherGlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[Kibali Teacher Dashboard Exception]:", error);
  }, [error]);

  return (
    <div className="w-full min-h-[75vh] flex items-center justify-center p-4">
      {/* Background Ambient Blur */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-rose-500/[0.03] blur-[140px]" />
      </div>

      <div className="w-full max-w-md text-center space-y-6">
        {/* Core Header Identity Badge */}
        <div className="flex justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20 shadow-md">
            <GraduationCap className="h-4 w-4 text-amber-400" />
          </div>
        </div>

        {/* Central Card Element */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Top visual warning strip */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />
          
          <div className="p-7 space-y-5">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/20">
                <AlertCircle className="h-6 w-6 text-rose-400" />
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-white tracking-tight mb-1.5">
                Data Connection Interrupted
              </h2>
              <p className="text-xs text-white/50 leading-relaxed max-w-xs mx-auto">
                The portal encountered an error while saving or loading your academic records. Your changes might not have saved yet.
              </p>
            </div>

            {/* Error Message For The Teacher */}
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-left space-y-1">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider">
                System Notice
              </p>
              <p className="text-xs font-mono text-rose-300/80 break-words line-clamp-2">
                {error.message || "An error occurred inside the classroom data pipeline."}
              </p>
            </div>

            {/* Interactive Control Blocks */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={() => reset()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-xs font-bold text-[#0c0f1a] hover:bg-amber-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Last Action
              </button>
              <button
                type="button"
                onClick={() => window.location.assign("/teachers")}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Teacher Home
              </button>
            </div>
          </div>
        </div>

        {error.digest && (
          <p className="text-[9px] font-mono text-white/20 select-all tracking-tight">
            Reference ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}