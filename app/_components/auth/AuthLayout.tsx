"use client";

import type { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-[#0d1b2a] relative overflow-hidden">
      {/* ── Background shapes (left panel decoration) ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute rounded-full blur-[80px] opacity-15 w-[500px] h-[500px] bg-[#2563eb] -top-[200px] -left-[100px]" />
        <div className="absolute rounded-full blur-[80px] opacity-15 w-[400px] h-[400px] bg-[#0891b2] -bottom-[150px] left-[30%]" />
        <div className="absolute rounded-full blur-[80px] opacity-15 w-[300px] h-[300px] bg-[#7c3aed] top-1/2 -right-[50px]" />
      </div>

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-center px-[60px] relative z-10">
        {/* Brand */}
        <div className="flex items-center gap-[14px] mb-[60px]">
          <div
            className="w-[52px] h-[52px] rounded-[14px] flex items-center justify-center text-[24px] flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #2563eb, #0891b2)",
              boxShadow: "0 8px 24px rgba(37,99,235,0.4)",
            }}
          >
            🎓
          </div>
          <div>
            <div className="text-[26px] font-extrabold text-white tracking-tight leading-none">
              EduTrack
            </div>
            <div className="text-[12px] text-white/50 mt-[1px]">
              School Management Platform
            </div>
          </div>
        </div>

        {/* Hero */}
        <div className="max-w-[420px]">
          <h1
            className="text-[42px] font-black text-white leading-[1.1] tracking-[-1px] mb-[18px]"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Smarter Schools
            <br />
            Start <span className="text-[#60a5fa]">Here.</span>
          </h1>
          <p className="text-[16px] text-white/60 leading-[1.7] mb-[36px]">
            Manage academics, track learner progress, communicate with parents,
            and publish results — all in one platform built for Kenyan schools.
          </p>

          {/* Stats */}
          <div className="flex gap-8">
            {[
              { val: "1,248", label: "Learners" },
              { val: "64", label: "Teachers" },
              { val: "16", label: "Streams" },
              { val: "98%", label: "SMS Delivery" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-[26px] font-extrabold text-white leading-none">
                  {s.val}
                </div>
                <div className="text-[12px] text-white/50 mt-[2px]">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="w-full lg:w-[480px] bg-white flex flex-col justify-center px-[44px] py-[52px] relative overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
