import { Link, ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

interface ListPageShellProps {
  icon: ReactNode;
  iconBg: string;
  subtitle: string;
  title: string;
  children: ReactNode;
}

export default function ListPageShell({
  icon,
  iconBg,
  subtitle,
  title,
  children,
}: ListPageShellProps) {
  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-60 left-1/4 w-[700px] h-[700px] rounded-full bg-amber-500/[0.04] blur-[140px]" />
        <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-500/[0.04] blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <header className="flex items-center gap-4">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-colors duration-200 flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 text-white/50" />
          </Link>

          <div
            className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${iconBg}`}
          >
            {icon}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
              Kibera Academy
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {title}
            </h1>
          </div>
        </header>

        {/* Table */}
        {children}

        {/* Footer */}
        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibera Academy Portal · Data refreshes every 60 seconds
          </p>
        </footer>
      </div>
    </div>
  );
}
