import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen bg-[#080C10] flex items-center justify-center p-4 font-[family-name:var(--font-body)]">
      {/* Background grid */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(200,168,75,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(200,168,75,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      {/* Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-amber-500/5 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo mark */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/25 shadow-lg shadow-amber-400/10 mb-4">
            <span className="text-2xl font-bold text-amber-400 tracking-tight">
              KA
            </span>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/60 mb-1">
            Kibali Academy
          </p>
          <h1 className="text-2xl font-bold text-white text-center">{title}</h1>
          <p className="text-sm text-white/40 mt-1 text-center max-w-xs">
            {subtitle}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-black/60">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
          <div className="p-8">{children}</div>
        </div>

        <p className="text-center text-[11px] text-white/20 mt-6">
          © {new Date().getFullYear()} Kibali Academy · Secure School Portal
        </p>
      </div>
    </div>
  );
}
