// app/_components/analytics/analytics-constants.ts
// Shared style constants and pure helpers — no React, no imports.

export const SS = {
  EE: {
    label: "Exceeds",
    bar: "bg-emerald-400",
    text: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/25",
  },
  ME: {
    label: "Meets",
    bar: "bg-sky-400",
    text: "text-sky-400",
    bg: "bg-sky-400/10",
    border: "border-sky-400/25",
  },
  AE: {
    label: "Approach",
    bar: "bg-amber-400",
    text: "text-amber-400",
    bg: "bg-amber-400/10",
    border: "border-amber-400/25",
  },
  BE: {
    label: "Below",
    bar: "bg-rose-400",
    text: "text-rose-400",
    bg: "bg-rose-400/10",
    border: "border-rose-400/25",
  },
} as const;

export type ScoreKey = keyof typeof SS;

export const LEVEL_COLOR: Record<
  string,
  { text: string; border: string; bg: string; dot: string }
> = {
  lower_primary: {
    text: "text-amber-400",
    border: "border-amber-400/20",
    bg: "bg-amber-400/5",
    dot: "bg-amber-400",
  },
  upper_primary: {
    text: "text-sky-400",
    border: "border-sky-400/20",
    bg: "bg-sky-400/5",
    dot: "bg-sky-400",
  },
  junior_secondary: {
    text: "text-emerald-400",
    border: "border-emerald-400/20",
    bg: "bg-emerald-400/5",
    dot: "bg-emerald-400",
  },
};

export const LEVEL_LABEL: Record<string, string> = {
  lower_primary: "Lower Primary",
  upper_primary: "Upper Primary",
  junior_secondary: "JSS",
};

export function meanLabel(wm: number): ScoreKey {
  if (wm >= 3.5) return "EE";
  if (wm >= 2.5) return "ME";
  if (wm >= 1.5) return "AE";
  return "BE";
}
