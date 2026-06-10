"use client";

// app/(teachers)/loading.tsx

import { GraduationCap } from "lucide-react";

export default function TeacherGlobalLoading() {
  return (
    <div className="w-full min-h-[70vh] flex flex-col items-center justify-center gap-6 relative">
      {/* Ambient Radial Background Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-amber-500/[0.02] blur-[130px]" />
      </div>

      {/* Hardware-accelerated smooth keyframe spinner */}
      <style>{`
        @keyframes teacher-ka-spin { to { transform: rotate(360deg); } }
        .teacher-ka-spin { animation: teacher-ka-spin 0.8s linear infinite; }
      `}</style>

      {/* Academic Branding Badge */}
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20 shadow-lg shadow-black/20">
        <GraduationCap className="h-5 w-5 text-amber-400" />
      </div>

      {/* Loading Information */}
      <div className="flex flex-col items-center gap-2 text-center px-4">
        <div className="w-8 h-8 rounded-full border-[2.5px] border-amber-400/10 border-t-amber-400 teacher-ka-spin" />
        <p className="text-white text-sm font-semibold tracking-wide mt-2">
          Loading Academic Records…
        </p>
        <p className="text-white/35 text-[11px]">
          Synchronizing class lists, rosters, and schedules. Please wait.
        </p>
      </div>
    </div>
  );
}