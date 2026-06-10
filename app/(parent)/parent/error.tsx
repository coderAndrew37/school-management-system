"use client";

// app/(parents)/error.tsx

import { useEffect } from "react";
import { GraduationCap, HeartHandshake, RefreshCw, Home } from "lucide-react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ParentGlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Keep internal tech logs strictly inside your developer console
    console.error("[Kibali Parent Dashboard Exception]:", error);
  }, [error]);

  return (
    <div className="w-full min-h-[75vh] flex items-center justify-center p-4">
      {/* Soft Ambient Blur */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-rose-500/[0.02] blur-[140px]" />
      </div>

      <div className="w-full max-w-md text-center space-y-6">
        {/* Core Header Identity Badge */}
        <div className="flex justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20 shadow-md">
            <GraduationCap className="h-4 w-4 text-amber-400" />
          </div>
        </div>

        {/* Central Card Container */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl shadow-2xl overflow-hidden">
          {/* Subtle gradient strip at the top */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/20 to-transparent" />
          
          <div className="p-7 space-y-5">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10 border border-amber-400/20">
                <HeartHandshake className="h-5 w-5 text-amber-400" />
              </div>
            </div>

            <div>
              <h2 className="text-base font-bold text-white tracking-tight mb-1.5">
                Portal Page Interrupted
              </h2>
              <p className="text-xs text-white/50 leading-relaxed max-w-xs mx-auto">
                The portal couldn&apos;t load this information right now. Don&apos;t worry—your data and records remain fully protected.
              </p>
            </div>

            {/* Helpful Support Instructions */}
            <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-left">
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-0.5">
                Need Assistance?
              </p>
              <p className="text-xs text-white/40 leading-relaxed">
                Try refreshing the page using the button below. If you still encounter an issue, please reach out to the school administration office.
              </p>
            </div>

            {/* Simple Controls */}
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                type="button"
                onClick={() => reset()}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-xs font-bold text-[#0c0f1a] hover:bg-amber-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh This Page
              </button>
              <button
                type="button"
                onClick={() => window.location.assign("/parent/dashboard")}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/10 py-2.5 text-xs font-semibold text-white/60 hover:text-white hover:bg-white/5 transition-all"
              >
                <Home className="h-3.5 w-3.5" />
                Portal Home
              </button>
            </div>
          </div>
        </div>

        {/* Hidden hash token used only for developer referencing if a parent sends a screenshot */}
        {error.digest && (
          <p className="text-[9px] font-mono text-white/15 tracking-tight">
            Support Ref: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}