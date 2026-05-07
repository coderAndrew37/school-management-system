"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-[#0a0c1a] relative overflow-hidden">
      {/* ── LEFT PANEL - Background Image ── */}
      <div className="hidden lg:flex flex-1 relative">
        {/* Background Image */}
        <Image
          src="/images/auth-bg.jpg"           // ← Put your image here
          alt="Kibali Academy Students"
          fill
          className="object-cover"
          priority
          quality={95}
        />

        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/60 to-black/40" />

        {/* Extra subtle vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(at_center,#00000040_40%,transparent_80%)]" />

        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-center px-16 xl:px-24 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          >
            {/* Brand */}
            <div className="flex items-center gap-4 mb-12">
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center text-4xl shadow-2xl z-10"
                style={{
                  background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                  boxShadow: "0 25px 50px -12px rgba(245, 158, 11, 0.6)",
                }}
              >
                🎓
              </div>
              <div>
                <div className="text-4xl font-black text-white tracking-tighter">
                  Kibali <span className="text-amber-400">Academy</span>
                </div>
                <div className="text-sm uppercase tracking-[3px] text-white/70 font-medium">
                  NAIROBI • KENYA
                </div>
              </div>
            </div>

            {/* Hero Text */}
            <div className="max-w-[520px]">
              <h1 className="text-6xl xl:text-7xl font-black text-white leading-[1.05] tracking-tighter mb-6">
                Shaping leaders.<br />
                Building futures.
              </h1>

              <p className="text-xl text-white/80 leading-relaxed max-w-md">
                Kenya’s premier school management platform. 
                Connecting administrators, teachers, and parents seamlessly.
              </p>
            </div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-2 gap-10">
              {[
                { val: "1,200+", label: "Happy Students" },
                { val: "45+", label: "Dedicated Staff" },
                { val: "99.9%", label: "Uptime" },
                { val: "24/7", label: "Support" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                >
                  <div className="text-4xl font-bold text-white mb-1 tracking-tight">
                    {stat.val}
                  </div>
                  <div className="text-white/60 text-sm font-medium">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom Branding Strip */}
        <div className="absolute bottom-8 left-16 text-white/40 text-sm font-medium">
          © {new Date().getFullYear()} Kibali Academy
        </div>
      </div>

      {/* ── RIGHT PANEL (Form) ── */}
      <div className="w-full lg:w-[560px] bg-white flex flex-col justify-center px-8 sm:px-12 xl:px-16 py-12 lg:py-16 relative z-20">
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="w-full max-w-md mx-auto"
        >
          {(title || subtitle) && (
            <div className="mb-10 text-center lg:text-left">
              {title && <h2 className="text-4xl font-semibold text-slate-900">{title}</h2>}
              {subtitle && <p className="mt-3 text-slate-600 text-lg">{subtitle}</p>}
            </div>
          )}

          {children}

          <div className="mt-12 text-center">
            <p className="text-xs text-slate-400">
              Built with precision by{" "}
              <span className="text-amber-600 font-medium">SleekSites</span>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}