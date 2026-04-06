// app/teacher/class/attendance/attendance-types.ts

import type { ClassStudent } from "@/lib/data/assessment";

export type Status = "Present" | "Absent" | "Late" | "Excused";

export type WeekPoint = {
  week: string;
  rate: number;
  present: number;
  absent: number;
  total: number;
};

export interface ParentContact {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
}

export interface StudentRow {
  studentId: string;
  full_name: string;
  readable_id: string | null;
  gender: "Male" | "Female" | null;
  status: Status;
  remarks: string;
  remarksOpen: boolean;
}

export interface AttendanceStat {
  studentId: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  total: number;
  rate: number;
  trend: "improving" | "declining" | "stable";
}

// Updated to match Class-based structure (Grade + Stream)
export interface AttendanceClientProps {
  teacherName: string;
  classId: string; // UUID of the specific class
  gradeName: string; // e.g., "Grade 4"
  streamName: string; // e.g., "North"
  availableClasses: {
    // Metadata for the class switcher
    id: string;
    grade: string;
    stream: string;
  }[];
  students: ClassStudent[];
  studentsWithParents: (ClassStudent & { parents: ParentContact[] })[];
  selectedDate: string;
  today: string;
  preFill: Record<string, { status: string; remarks: string }>;
  weekDatesRecorded: string[];
  attendanceHistory: Record<string, { date: string; status: Status }[]>;
  classWeeklyTrend: WeekPoint[];
  activeTab: "register" | "trends";
}

export const STATUSES: Status[] = ["Present", "Late", "Absent", "Excused"];
export const AT_RISK_THRESHOLD = 75;
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export const STATUS_CFG: Record<
  Status,
  {
    label: string;
    short: string;
    active: string;
    inactive: string;
    text: string;
    dot: string;
  }
> = {
  Present: {
    label: "Present",
    short: "P",
    active:
      "bg-emerald-500 text-white ring-2 ring-emerald-300 scale-105 shadow-sm",
    inactive:
      "bg-slate-100 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600",
    text: "text-emerald-600",
    dot: "bg-emerald-500",
  },
  Late: {
    label: "Late",
    short: "L",
    active: "bg-amber-400 text-white ring-2 ring-amber-300 scale-105 shadow-sm",
    inactive:
      "bg-slate-100 text-slate-400 hover:bg-amber-50 hover:text-amber-600",
    text: "text-amber-600",
    dot: "bg-amber-400",
  },
  Absent: {
    label: "Absent",
    short: "A",
    active: "bg-rose-500 text-white ring-2 ring-rose-300 scale-105 shadow-sm",
    inactive:
      "bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-600",
    text: "text-rose-600",
    dot: "bg-rose-500",
  },
  Excused: {
    label: "Excused",
    short: "E",
    active: "bg-sky-500 text-white ring-2 ring-sky-300 scale-105 shadow-sm",
    inactive: "bg-slate-100 text-slate-400 hover:bg-sky-50 hover:text-sky-600",
    text: "text-sky-600",
    dot: "bg-sky-500",
  },
};

// ── Pure helpers (no React) ───────────────────────────────────────────────────

export function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getWeekDays(date: string): string[] {
  const d = new Date(date + "T00:00:00");
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(mon);
    day.setDate(mon.getDate() + i);
    return toLocalDate(day);
  });
}

export function shiftWeek(date: string, dir: -1 | 1): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + dir * 7);
  return toLocalDate(d);
}

export function formatLong(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-KE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

/**
 * Computes individual student statistics based on historical attendance logs.
 * Uses a simple midpoint split to determine the trend (improving/declining).
 */
export function computeStats(
  students: ClassStudent[],
  history: Record<string, { date: string; status: Status }[]>,
): AttendanceStat[] {
  return students.map((s) => {
    const records = history[s.id] ?? [];
    const total = records.length;

    if (total === 0) {
      return {
        studentId: s.id,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
        rate: 100,
        trend: "stable",
      };
    }

    const present = records.filter((r) => r.status === "Present").length;
    const absent = records.filter((r) => r.status === "Absent").length;
    const late = records.filter((r) => r.status === "Late").length;
    const excused = records.filter((r) => r.status === "Excused").length;

    // Rate considers both Present and Late as "attended"
    const rate = Math.round(((present + late) / total) * 100);

    // Trend calculation
    const half = Math.floor(total / 2);
    const older = records.slice(0, half);
    const newer = records.slice(half);

    const calculateRate = (subset: { status: Status }[]) => {
      if (subset.length === 0) return 1;
      return (
        subset.filter((r) => r.status === "Present" || r.status === "Late")
          .length / subset.length
      );
    };

    const oldRate = calculateRate(older);
    const newRate = calculateRate(newer);
    const diff = newRate - oldRate;

    let trend: "improving" | "declining" | "stable" = "stable";
    if (diff > 0.05) trend = "improving";
    else if (diff < -0.05) trend = "declining";

    return {
      studentId: s.id,
      present,
      absent,
      late,
      excused,
      total,
      rate,
      trend,
    };
  });
}
