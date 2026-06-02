"use client";

// @/app/admin/staff/_components/ui.tsx

import { motion, AnimatePresence } from "framer-motion";
import { X }                       from "lucide-react";
import type {
  ReactNode,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import type { BaseRole }            from "@/lib/types/auth";
import { BASE_ROLE_LABELS }         from "@/lib/types/auth";

// ── Modal ────────────────────────────────────────────────────

interface ModalProps { isOpen: boolean; onClose: () => void; children: ReactNode; size?: "md" | "lg"; }

export function Modal({ isOpen, onClose, children, size = "md" }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div key="bd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-stone-900/50 backdrop-blur-[2px]"
            onClick={onClose} />
          <motion.div key="sh"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className={`w-full ${size === "lg" ? "max-w-2xl" : "max-w-lg"} rounded-2xl bg-white shadow-2xl shadow-stone-900/20 ring-1 ring-stone-900/5 pointer-events-auto`}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ── Modal Header ─────────────────────────────────────────────

interface ModalHeaderProps { title: string; subtitle?: string; onClose: () => void; }

export function ModalHeader({ title, subtitle, onClose }: ModalHeaderProps) {
  return (
    <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-stone-100">
      <div>
        <h2 className="font-serif text-xl font-semibold text-stone-900 leading-tight">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-stone-500">{subtitle}</p>}
      </div>
      <button type="button" onClick={onClose}
        className="ml-4 shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
        <X className="h-4 w-4" /><span className="sr-only">Close</span>
      </button>
    </div>
  );
}

// ── Field ─────────────────────────────────────────────────────

interface FieldProps { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode; }

export function Field({ label, required, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-widest text-stone-500">
        {label}{required && <span className="ml-0.5 text-amber-600">*</span>}
      </label>
      {children}
      {hint  && !error && <p className="text-xs text-stone-400">{hint}</p>}
      {error &&           <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  );
}

// ── Form controls ─────────────────────────────────────────────

const base = "w-full rounded-xl border bg-stone-50 px-3.5 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400 transition-shadow disabled:opacity-50";
const ok   = "border-stone-200";
const bad  = "border-red-300 focus:ring-red-300/40 focus:border-red-400";

export function Input({ hasError, className = "", ...p }: InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }) {
  return <input className={`${base} ${hasError ? bad : ok} ${className}`} {...p} />;
}
export function Select({ hasError, className = "", children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { hasError?: boolean }) {
  return <select className={`${base} ${hasError ? bad : ok} ${className}`} {...p}>{children}</select>;
}
export function Textarea({ hasError, className = "", ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { hasError?: boolean }) {
  return <textarea className={`${base} ${hasError ? bad : ok} min-h-[88px] resize-y ${className}`} {...p} />;
}

// ── Button ────────────────────────────────────────────────────

type Variant = "primary" | "secondary" | "danger" | "ghost";
const BV: Record<Variant, string> = {
  primary:   "bg-amber-600 text-white hover:bg-amber-700 shadow-sm shadow-amber-900/10 disabled:bg-amber-300",
  secondary: "bg-white text-stone-700 border border-stone-200 hover:bg-stone-50 disabled:opacity-50",
  danger:    "bg-red-600 text-white hover:bg-red-700 shadow-sm shadow-red-900/10 disabled:bg-red-300",
  ghost:     "text-stone-600 hover:bg-stone-100 disabled:opacity-50",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; loading?: boolean; children: ReactNode; }

export function Button({ variant = "primary", loading, children, className = "", disabled, ...p }: ButtonProps) {
  return (
    <button disabled={loading || disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${BV[variant]} ${className}`}
      {...p}>
      {loading && (
        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ── Role Badge ────────────────────────────────────────────────

const baseStyles: Partial<Record<BaseRole, string>> = {
  admin:   "bg-amber-50   text-amber-800   ring-amber-200",
  staff: "bg-sky-50     text-sky-800     ring-sky-200",
  parent:  "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

// Admin role colours — keyed by slug for seeded roles, fallback for custom
const adminPalette = [
  "bg-violet-50 text-violet-800 ring-violet-200",
  "bg-teal-50   text-teal-800   ring-teal-200",
  "bg-orange-50 text-orange-800 ring-orange-200",
  "bg-blue-50   text-blue-800   ring-blue-200",
  "bg-rose-50   text-rose-800   ring-rose-200",
  "bg-lime-50   text-lime-800   ring-lime-200",
];
function adminBadgeStyle(slug: string) {
  const idx = slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % adminPalette.length;
  return adminPalette[idx];
}

interface RoleBadgeProps { role: string; type: "base" | "admin"; label?: string; }

export function RoleBadge({ role, type, label }: RoleBadgeProps) {
  const styles = type === "base"
    ? (baseStyles[role as BaseRole] ?? "bg-stone-100 text-stone-600 ring-stone-200")
    : adminBadgeStyle(role);

  const text = label ?? (
    type === "base"
      ? (BASE_ROLE_LABELS[role as BaseRole] ?? role)
      : role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );

  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}>
      {text}
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────────

const PALETTE = [
  "bg-amber-100 text-amber-800","bg-sky-100 text-sky-800",
  "bg-violet-100 text-violet-800","bg-teal-100 text-teal-800",
  "bg-rose-100 text-rose-800","bg-lime-100 text-lime-800",
  "bg-orange-100 text-orange-800",
];

interface AvatarProps { id: string; name: string | null; src?: string | null; size?: "sm" | "md"; }

import Image from "next/image";

export function Avatar({ id, name, src, size = "md" }: AvatarProps) {
  const color = PALETTE[id.charCodeAt(0) % PALETTE.length];
  const dim   = size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";
  const ini   = (name ?? "?").split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();

  // Convert size keys to explicit pixel dimensions required by Next.js Image
  const pixelSize = size === "sm" ? 32 : 36;

  if (src) {
    return (
      <div className={`${dim} relative shrink-0`}>
        <Image
          src={src}
          alt={name ?? "User avatar"}
          width={pixelSize}
          height={pixelSize}
          className="rounded-full object-cover ring-2 ring-white"
        />
      </div>
    );
  }

  return (
    <div className={`${dim} ${color} rounded-full flex items-center justify-center font-semibold shrink-0`}>
      {ini}
    </div>
  );
}