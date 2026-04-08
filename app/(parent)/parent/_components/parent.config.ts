export const SCORE_COLORS: Record<string, string> = {
  EE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  ME: "bg-blue-100 text-blue-700 border-blue-200",
  AE: "bg-amber-100 text-amber-700 border-amber-200",
  BE: "bg-rose-100 text-rose-700 border-rose-200",
};

export const ATT_CONFIG: Record<
  string,
  { icon: string; text: string; cls: string }
> = {
  Present: {
    icon: "✅",
    text: "At school today",
    cls: "bg-emerald-50 border-emerald-200 text-emerald-700",
  },
  Absent: {
    icon: "❌",
    text: "Absent today",
    cls: "bg-rose-50 border-rose-200 text-rose-700",
  },
  Late: {
    icon: "🕐",
    text: "Arrived late",
    cls: "bg-amber-50 border-amber-200 text-amber-700",
  },
  Excused: {
    icon: "📋",
    text: "Excused absence",
    cls: "bg-sky-50 border-sky-200 text-sky-700",
  },
};