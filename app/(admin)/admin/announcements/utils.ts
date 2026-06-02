// utils.ts — pure date/formatting helpers (no React, no side-effects)

export function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtShort(iso: string): string {
  return new Date(
    iso.includes("T") ? iso : iso + "T00:00:00",
  ).toLocaleDateString("en-KE", { day: "numeric", month: "short" });
}

export function daysUntil(iso: string): number {
  return Math.ceil(
    (new Date(iso + "T00:00:00").getTime() - new Date().setHours(0, 0, 0, 0)) /
      86400000,
  );
}

export function urgencyBadge(
  days: number,
): { label: string; cls: string } | null {
  if (days === 0)
    return {
      label: "Today",
      cls: "bg-rose-400/15 text-rose-400 border-rose-400/25",
    };
  if (days === 1)
    return {
      label: "Tomorrow",
      cls: "bg-amber-400/15 text-amber-400 border-amber-400/25",
    };
  if (days <= 7)
    return {
      label: `In ${days}d`,
      cls: "bg-sky-400/15 text-sky-400 border-sky-400/25",
    };
  return null;
}