import { getSession } from "@/lib/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ArrowLeft,
  Calendar,
  GraduationCap,
  UserCheck,
  Users,
  ChevronRight,
  LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StudentRow {
  id:          string;
  full_name:   string;
  upi_number:  string | null;
  gender:      string;
  status:      string;
  photo_url:   string | null;
  current_grade: string;
}

interface TeacherProfile {
  full_name: string;
}

interface TeacherRow {
  staff_id: string;
  profiles: TeacherProfile | null; // Belongs-to relationship returns a single object
}

interface AssignmentRow {
  is_active: boolean;
  teachers: TeacherRow | null;
}

interface ClassRow {
  id: string;
  grade: string;
  stream: string;
  level: string;
  academic_year: number;
  school_id: string;
  class_teacher_assignments: AssignmentRow[] | null;
}

type Props = {
  params: Promise<{ id: string }>;
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ClassDetailsPage({ params }: Props) {
  const { id } = await params;

  const session = await getSession();
  if (!session?.profile) redirect("/login");

  const { base_role, is_super_admin, is_dev, school_id } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;
  if (base_role !== "admin" && !isPlatformAdmin) redirect("/dashboard");
  if (!school_id) redirect("/login");

  const supabase = await createSupabaseServerClient();

  // ── Fetch class + assignment (no students join — students link via current_grade) ──
 const { data: classData, error: classError } = await supabase
  .from("classes")
  .select(`
    id,
    grade,
    stream,
    level,
    academic_year,
    school_id,
    class_teacher_assignments (
      is_active,
      teachers (
        staff_id,
        profiles ( full_name )
      )
    )
  `)
  .eq("id", id)
  .eq("school_id", school_id)
  .single();

if (classError || !classData) {
  console.error("[ClassDetailsPage] class fetch error:", JSON.stringify(classError));
  notFound();
}

  const cls = classData as unknown as ClassRow;

  // ── Fetch students separately via current_grade ────────────────────────────
  const { data: rawStudents, error: studentsError } = await supabase
    .from("students")
    .select("id, full_name, upi_number, gender, status, photo_url, current_grade")
    .eq("school_id", school_id)
    .eq("current_grade", cls.grade)
    .order("full_name");

  if (studentsError) {
    console.error("[ClassDetailsPage] students fetch error:", JSON.stringify(studentsError));
  }

  const students: StudentRow[] = rawStudents ?? [];

  // ── Derive active teacher ──────────────────────────────────────────────────
const activeAssignment = cls.class_teacher_assignments?.find((a) => a.is_active);
const teacherRow = activeAssignment?.teachers ?? null;

// Clean type guard handling to eliminate downstream runtime exceptions
const teacherProfile = teacherRow
  ? Array.isArray(teacherRow.profiles)
    ? teacherRow.profiles[0]
    : teacherRow.profiles
  : null;

const activeTeacherName = teacherProfile?.full_name ?? null;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const maleCount   = students.filter((s) => s.gender === "Male").length;
  const femaleCount = students.filter((s) => s.gender === "Female").length;
  const capacity    = 45;
  const fillPct     = Math.min(Math.round((students.length / capacity) * 100), 100);

  const levelLabel = (cls.level ?? "").replace(/_/g, " ");

  // Level accent colours
  const levelAccents: Record<string, { badge: string; badgeText: string; dot: string }> = {
    lower_primary:    { badge: "bg-sky-400/10 border-sky-400/20",     badgeText: "text-sky-400",     dot: "bg-sky-400"    },
    upper_primary:    { badge: "bg-amber-400/10 border-amber-400/20", badgeText: "text-amber-400",   dot: "bg-amber-400"  },
    junior_secondary: { badge: "bg-emerald-400/10 border-emerald-400/20", badgeText: "text-emerald-400", dot: "bg-emerald-400" },
  };
  const accent = levelAccents[cls.level] ?? { badge: "bg-white/5 border-white/10", badgeText: "text-white/50", dot: "bg-white/30" };

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-60 left-1/4 w-[700px] h-[700px] rounded-full bg-amber-500/[0.04] blur-[140px]" />
        <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-500/[0.04] blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <header className="bg-[#0c0f1a]/80 backdrop-blur-md border-b border-white/[0.07] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                Kibali Academy
              </p>
              <h1 className="text-sm font-bold tracking-tight text-white">
                {cls.grade} — {cls.stream}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/classes"
              className="flex items-center gap-1 text-xs font-semibold text-white/30 hover:text-white/70 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Registry
            </Link>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Hero card ── */}
        <div className="rounded-3xl border border-white/[0.07] bg-white/[0.03] p-8 relative overflow-hidden">
          {/* Decorative icon */}
          <GraduationCap className="absolute -right-4 -bottom-4 h-40 w-40 text-white/[0.025] pointer-events-none" />

          <div className="relative z-10 space-y-5">
            {/* Level badge */}
            <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border ${accent.badge} ${accent.badgeText}`}>
              {levelLabel}
            </span>

            <h2 className="text-4xl font-black text-white tracking-tight">
              {cls.grade}
              <span className="text-white/30 font-normal"> — </span>
              {cls.stream}
            </h2>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-3 pt-2">
              {/* Students */}
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
                  <Users className="h-4 w-4 text-amber-400" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Students</p>
                  <p className="text-lg font-black text-white">{students.length}</p>
                </div>
              </div>

              {/* Class teacher */}
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                  activeTeacherName
                    ? "bg-emerald-400/10 border border-emerald-400/20"
                    : "bg-white/[0.03] border border-white/[0.07]"
                }`}>
                  <UserCheck className={`h-4 w-4 ${activeTeacherName ? "text-emerald-400" : "text-white/20"}`} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Class Teacher</p>
                  <p className={`text-sm font-bold ${activeTeacherName ? "text-emerald-400" : "text-white/25 italic"}`}>
                    {activeTeacherName ?? "Unassigned"}
                  </p>
                </div>
              </div>

              {/* Academic year */}
              <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                <div className="h-9 w-9 rounded-xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center">
                  <Calendar className="h-4 w-4 text-white/30" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Academic Year</p>
                  <p className="text-lg font-black text-white">{cls.academic_year}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main content grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Roster table ── */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                Student Roster
              </h2>
              <p className="text-[11px] font-bold text-white/25 font-mono">
                {maleCount}M · {femaleCount}F
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/[0.07]">
                  <tr>
                    {["Student", "UPI / ID", "Gender", ""].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3.5 text-[10px] font-black uppercase tracking-wider text-white/25"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-xs font-black text-amber-400 shrink-0">
                            {student.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-white text-sm">
                            {student.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-white/30">
                        {student.upi_number || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          student.gender === "Male"
                            ? "bg-sky-400/10 text-sky-400"
                            : student.gender === "Female"
                            ? "bg-pink-400/10 text-pink-400"
                            : "bg-white/5 text-white/30"
                        }`}>
                          {student.gender || "—"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/admin/students/${student.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-white/25 group-hover:text-amber-400/70 transition-colors"
                        >
                          Profile <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {students.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-14 text-center">
                        <LayoutGrid className="h-8 w-8 mx-auto mb-3 text-white/10" />
                        <p className="text-sm text-white/20 font-semibold">
                          No students enrolled in this class yet.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">

            {/* Capacity */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25">
                Capacity
              </h3>

              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-black text-white">{students.length}</span>
                <span className="text-xs text-white/25 font-mono">/ {capacity}</span>
              </div>

              <div className="w-full h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    fillPct >= 90 ? "bg-rose-400" : fillPct >= 70 ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>

              <p className="text-[11px] text-white/25 font-mono">{fillPct}% filled</p>
            </div>

            {/* Gender breakdown */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25">
                Gender split
              </h3>

              <div className="space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-sky-400 font-bold">Male</span>
                    <span className="text-xs font-mono text-white/40">{maleCount}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-sky-400 transition-all duration-700"
                      style={{ width: students.length > 0 ? `${Math.round((maleCount / students.length) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-pink-400 font-bold">Female</span>
                    <span className="text-xs font-mono text-white/40">{femaleCount}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-pink-400 transition-all duration-700"
                      style={{ width: students.length > 0 ? `${Math.round((femaleCount / students.length) * 100)}%` : "0%" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick links */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 space-y-3">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25">
                Quick links
              </h3>
              <Link
                href="/admin/class-teachers"
                className="flex items-center justify-between text-xs font-semibold text-white/40 hover:text-amber-400/80 transition-colors py-1"
              >
                Manage class teachers <ChevronRight className="h-3 w-3" />
              </Link>
              <Link
                href="/admin/students"
                className="flex items-center justify-between text-xs font-semibold text-white/40 hover:text-amber-400/80 transition-colors py-1"
              >
                All students <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy · CBC School Management System · Academic Year {cls.academic_year}
          </p>
        </footer>

      </main>
    </div>
  );
}