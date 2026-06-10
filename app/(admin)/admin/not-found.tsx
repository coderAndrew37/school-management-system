
import { GraduationCap, FileQuestion, MoveLeft } from "lucide-react";
import Link from "next/link";

export default function AdminGlobalNotFound() {
  return (
    <div className="w-full min-h-[75vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center space-y-6">
        {/* Top Logo */}
        <div className="flex justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20 shadow-md">
            <GraduationCap className="h-4 w-4 text-amber-400" />
          </div>
        </div>

        {/* Structural Card Container */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-8 space-y-5 shadow-2xl">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10 border border-amber-400/20">
              <FileQuestion className="h-5 w-5 text-amber-400" />
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold text-white tracking-tight mb-1">
              Resource Ledger Missing
            </h2>
            <p className="text-xs text-white/50 leading-relaxed max-w-xs mx-auto">
              The platform route parameter string you are looking for does not point to an active record across this tenant domain registry.
            </p>
          </div>

          <div className="pt-2 border-t border-white/[0.06]">
            <Link
              href="/admin/dashboard"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-white/[0.05] border border-white/10 py-2.5 text-xs font-bold text-white/80 hover:text-white hover:bg-white/[0.08] transition-all"
            >
              <MoveLeft className="h-3.5 w-3.5" />
              Return to Central Admin Center
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}