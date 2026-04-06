// app/teacher/conduct/conduct.config.ts
// Pure display constants and formatting helpers.
// No React, no hooks, no server imports — safe to import anywhere.

import type { ConductType, Severity } from "@/lib/schemas/conduct";

// ── Type display config ───────────────────────────────────────────────────────

export interface TypeConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  dot: string;
}

export const TYPE_CFG: Record<ConductType, TypeConfig> = {
  merit: {
    label: "Merit",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  demerit: {
    label: "Demerit",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-400",
  },
  incident: {
    label: "Incident",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
};

// ── Severity display config ───────────────────────────────────────────────────

export interface SeverityConfig {
  label: string;
  cls: string;
}

export const SEVERITY_CFG: Record<Severity, SeverityConfig> = {
  low: { label: "Low", cls: "bg-slate-100 text-slate-600" },
  medium: { label: "Medium", cls: "bg-amber-100 text-amber-700" },
  high: { label: "High", cls: "bg-rose-100 text-rose-700" },
};

// ── Quick description presets ─────────────────────────────────────────────────

export const QUICK_DESCRIPTIONS: Record<ConductType, string[]> = {
  merit: [
    "Helped a classmate without being asked",
    "Outstanding performance in class activity",
    "Showed excellent leadership in group work",
    "Consistently punctual and prepared this week",
    "Went above and beyond on their assignment",
  ],
  demerit: [
    "Disrupted the class during lesson",
    "Failed to submit homework three times",
    "Disrespectful to a fellow student",
    "Using phone during class time",
    "Persistent late arrival without explanation",
  ],
  incident: [
    "Physical altercation with another student",
    "Bullying behaviour reported by peers",
    "Vandalism of school property",
    "Extreme defiance towards teacher instruction",
    "Absent without permission or parent note",
  ],
};

// ── Formatting helpers ────────────────────────────────────────────────────────

export function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase();
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });
}

// Grade + stream joined for display, e.g. "Grade 4 North"
export function classLabel(grade: string, stream: string): string {
  return stream === "Main" ? grade : `${grade} ${stream}`;
}
