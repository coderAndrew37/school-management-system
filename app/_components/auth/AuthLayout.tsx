"use client";

import type { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

interface AuthLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

// Carousel Images - Replace with your real images
const carouselImages = [
  "/images/auth-bg.jpg",
  "/images/auth/auth-2.jpg",
  "/images/auth/auth-3.jpg",
  "/images/auth/auth-4.jpg",
];

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const [currentImage, setCurrentImage] = useState(0);

  // Auto carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % carouselImages.length);
    }, 6500); // Change image every 6.5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex bg-[#0a0c1a] relative overflow-hidden">
      {/* ── FULL BACKGROUND CAROUSEL ── */}
      <div className="absolute inset-0 hidden lg:block">
        <AnimatePresence mode="wait">
          {carouselImages.map((src, index) => (
            <motion.div
              key={src}
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: currentImage === index ? 1 : 0 
              }}
              transition={{ duration: 1.2, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              <Image
                src={src}
                alt={`Kibali Academy ${index + 1}`}
                fill
                className="object-cover"
                priority={index === 0}
                quality={92}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Stronger gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/60 to-black/40" />
        <div className="absolute inset-0 bg-[radial-gradient(at_center,#00000050_30%,transparent_70%)]" />
      </div>

      {/* ── LEFT CONTENT OVERLAY ── */}
      <div className="hidden lg:flex flex-1 relative z-10 flex-col justify-center px-16 xl:px-24">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          {/* Brand */}
          <div className="flex items-center gap-4 mb-12">
            <div
              className="w-16 h-16 rounded-3xl flex items-center justify-center text-4xl shadow-2xl"
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
                KHUMSALABA • KENYA
              </div>
            </div>
          </div>

          {/* Hero Text */}
          <div className="max-w-[520px]">
            <h1 className="text-6xl xl:text-7xl font-black text-white leading-[1.05] tracking-tighter mb-6">
              Shaping leaders.<br />
              Building futures.
            </h1>

            <p className="text-xl text-white/80 leading-relaxed">
              Kenya’s most elegant school management platform.
            </p>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-2 gap-x-12 gap-y-10">
            {[
              { val: "1,200+", label: "Happy Students" },
              { val: "45+", label: "Dedicated Staff" },
              { val: "99.9%", label: "System Uptime" },
              { val: "24/7", label: "Support" },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                <div className="text-4xl font-bold text-white tracking-tighter">
                  {stat.val}
                </div>
                <div className="text-white/70 text-sm font-medium">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* ── RIGHT PANEL (Form) ── */}
      <div className="w-full lg:w-[560px] bg-white flex flex-col justify-center px-8 sm:px-12 xl:px-16 py-12 lg:py-16 relative z-20 shadow-2xl">
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
            <p className="text-xl text-slate-400">
              Built with precision by{" "}
              <a href="https://sleeksites.co.ke" target="_blank" rel="noopener noreferrer">
                <span className="text-amber-600 font-medium">SleekSites</span>
              </a>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}