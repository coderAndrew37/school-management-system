import { GraduationCap } from "lucide-react";
import type { ParentShellProps } from "@/lib/types/parent";

export function ParentShell({ children }: ParentShellProps) {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#fdf8f3", fontFamily: "'Nunito', sans-serif" }}
    >
      {/* Ambient warm blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-amber-200/30 blur-[80px]" />
        <div className="absolute bottom-0 -left-20 w-80 h-80 rounded-full bg-orange-200/20 blur-[60px]" />
      </div>

      {/* Sticky top bar */}
      <header className="sticky top-0 z-10 bg-amber-50/80 backdrop-blur-md border-b border-amber-100/60">
        <div className="flex items-center gap-2.5 px-4 py-3 max-w-lg mx-auto">
          <div className="h-7 w-7 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
            <GraduationCap className="h-4 w-4 text-amber-600" />
          </div>
          <span className="text-sm font-bold text-amber-700 tracking-tight">
            Kibera Academy
          </span>
          <span className="ml-auto text-xs text-stone-400 font-medium">
            Parent Portal
          </span>
        </div>
      </header>

      <main className="relative max-w-lg mx-auto px-4 py-6 pb-16">
        {children}
      </main>
    </div>
  );
}
