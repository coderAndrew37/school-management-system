import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { PaymentStatus } from "@/lib/types/governance";
import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import React from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmt = (n: number) =>
  `KES ${n.toLocaleString("en-KE", { minimumFractionDigits: 0 })}`;

export const fieldBase =
  "w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 disabled:opacity-50";

export const STATUS_META: Record<
  PaymentStatus,
  { cls: string; icon: React.ReactNode; label: string }
> = {
  paid: {
    cls: "text-emerald-400 border-emerald-400/25 bg-emerald-400/10",
    icon: React.createElement(CheckCircle2, { className: "h-3 w-3" }),
    label: "Paid",
  },
  partial: {
    cls: "text-amber-400 border-amber-400/25 bg-amber-400/10",
    icon: React.createElement(Clock, { className: "h-3 w-3" }),
    label: "Partial",
  },
  pending: {
    cls: "text-sky-400 border-sky-400/25 bg-sky-400/10",
    icon: React.createElement(Clock, { className: "h-3 w-3" }),
    label: "Pending",
  },
  overdue: {
    cls: "text-rose-400 border-rose-400/25 bg-rose-400/10",
    icon: React.createElement(AlertCircle, { className: "h-3 w-3" }),
    label: "Overdue",
  },
  waived: {
    cls: "text-white/40 border-white/10 bg-white/5",
    icon: null,
    label: "Waived",
  },
};