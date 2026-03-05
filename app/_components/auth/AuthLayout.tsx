"use client";

import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  /** Primary heading for the auth form */
  title?: string;
  /** Supporting text below the heading */
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-[#0c0f1a] relative overflow-hidden">
      {/* ── Background Decoration ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute rounded-full blur-[120px] opacity-20 w-[600px] h-[600px] bg-blue-600 -top-[200px] -left-[100px]" />
        <div className="absolute rounded-full blur-[100px] opacity-10 w-[400px] h-[400px] bg-emerald-500 -bottom-[150px] left-[20%]" />
        <div className="absolute rounded-full blur-[100px] opacity-15 w-[500px] h-[500px] bg-amber-500 top-1/4 -right-[100px]" />
      </div>

      {/* ── LEFT PANEL (Branding & Hero) ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-[80px] relative z-10">
        {/* Brand */}
        <div className="flex items-center gap-4 mb-12">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-2xl"
            style={{
              background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
              boxShadow: "0 10px 30px -5px rgba(245, 158, 11, 0.4)",
            }}
          >
            🎓
          </div>
          <div>
            <div className="text-3xl font-black text-white tracking-tight leading-none">
              Kibali <span className="text-amber-400">Academy</span>
            </div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/40 mt-1.5 font-bold">
              Governance Portal
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div className="max-w-[460px]">
          <h1 className="text-5xl font-black text-white leading-[1.1] tracking-tight mb-6">
            Smarter Schools. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              Better Futures.
            </span>
          </h1>
          <p className="text-lg text-white/50 leading-relaxed mb-10">
            A comprehensive management ecosystem for Kenyan institutions.
            Empowering teachers, engaging parents, and streamlining
            administration.
          </p>

          {/* Social Proof / Stats */}
          <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-10">
            {[
              { val: "1.2k+", label: "Active Students" },
              { val: "99.9%", label: "System Uptime" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-white mb-1">
                  {s.val}
                </div>
                <div className="text-xs uppercase tracking-widest text-white/30 font-semibold">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL (Form Container) ── */}
      <div className="w-full lg:w-[540px] bg-white flex flex-col justify-center px-8 sm:px-16 py-12 relative z-20">
        {/* Header section (Now strictly typed) */}
        {(title || subtitle) && (
          <div className="mb-10 text-center lg:text-left">
            {title && (
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="mt-3 text-slate-500 font-medium leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Form Content */}
        <div className="w-full max-w-sm mx-auto lg:mx-0">{children}</div>

        {/* Footer info */}
        <div className="mt-12 pt-8 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 font-medium">
            &copy; {new Date().getFullYear()} Kibali Academy. Built with
            precision for excellence.
          </p>
        </div>
      </div>
    </div>
  );
}
