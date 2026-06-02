// constants.ts — static data and shared style tokens

import { AlertTriangle, Info } from "lucide-react";

export const GRADES = [
  "All grades",
  "PP1",
  "PP2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7 / JSS 1",
  "Grade 8 / JSS 2",
  "Grade 9 / JSS 3",
] as const;

// ── Shared input / label class tokens ────────────────────────────────────────

export const INP =
  "w-full rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-amber-400/40 focus:bg-white/[0.07] transition-all";

export const SEL = INP + " appearance-none cursor-pointer";

export const LBL =
  "block text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5";

// ── Priority visual config ────────────────────────────────────────────────────

export type Priority = "urgent" | "normal";

export const PRIORITY_CONFIG: Record<
  Priority,
  {
    icon: React.ReactNode;
    card: string;
    dot: string;
    badge: string;
  }
> = {
  urgent: {
    icon: <AlertTriangle className="h-4 w-4" />,
    card: "border-rose-400/25 bg-rose-400/[0.06]",
    dot: "bg-rose-400",
    badge: "bg-rose-400/15 text-rose-400 border-rose-400/25",
  },
  normal: {
    icon: <Info className="h-4 w-4" />,
    card: "border-white/[0.07] bg-white/[0.02]",
    dot: "bg-sky-400",
    badge: "bg-sky-400/15 text-sky-400 border-sky-400/25",
  },
};