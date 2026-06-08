import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { ClassTeacherClient } from "./ClassTeacherClient";
import type {
  ClassRecord,
  TeacherOption,
  AssignmentRow,
} from "./ClassTeacherClient";

export const metadata = { title: "Class Teacher Assignments | Admin" };
export const revalidate = 0;

// ── Raw Supabase join shapes ───────────────────────────────────────────────────

interface RawAssignmentRow {
  id:            string;
  class_id:      string;
  academic_year: number;
  classes: {
    grade:  string;
    stream: string;
  } | null;
  teachers: {
    id: string;
    profiles: {
      full_name: string;
      email:     string | null;
    } | null;
  } | null;
}

// Supabase returns the profile join as object | object[] | null depending on
// how the foreign key is configured. This helper normalises both shapes.
function pickProfile(
  raw: { full_name: string; email: string | null } | { full_name: string; email: string | null }[] | null,
) {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

export default async function ClassTeachersPage() {
  const session = await getSession();
  if (!session?.profile) redirect("/login");

  const { base_role, is_super_admin, is_dev, school_id } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  if (base_role !== "admin" && !isPlatformAdmin) redirect("/dashboard");
  if (!school_id) redirect("/login");

  const supabase = await createSupabaseServerClient();

  // ── 1. Academic year from system settings ──────────────────────────────────
  const { data: settings } = await supabase
    .from("system_settings")
    .select("current_academic_year")
    .eq("id", 1)
    .single();

  const activeYear = settings?.current_academic_year ?? 2026;

  // ── 2. Parallel data fetches ───────────────────────────────────────────────
  const [
    { data: rawClasses },
    { data: rawTeachers },
    { data: rawAssignments },
    { data: studentRows },
  ] = await Promise.all([
    // Classes scoped to this school + year
    supabase
      .from("classes")
      .select("id, grade, stream")
      .eq("school_id",    school_id)
      .eq("academic_year", activeYear)
      .order("grade"),

    // Teachers — profiles join normalised by pickProfile
    supabase
      .from("teachers")
      .select("id, tsc_number, profiles ( full_name, email )")
      .eq("school_id", school_id)
      .eq("status",    "active"),

    // Active assignments scoped to school + year
    supabase
      .from("class_teacher_assignments")
      .select(`
        id,
        class_id,
        academic_year,
        classes  ( grade, stream ),
        teachers ( id, profiles ( full_name, email ) )
      `)
      .eq("school_id",    school_id)
      .eq("academic_year", activeYear)
      .eq("is_active",     true)
      .returns<RawAssignmentRow[]>(),

    // Student counts — only need current_grade
    supabase
      .from("students")
      .select("current_grade")
      .eq("school_id", school_id),
  ]);

  // ── 3. Shape teachers ──────────────────────────────────────────────────────
  const teachers: TeacherOption[] = (rawTeachers ?? [])
    .map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profile = pickProfile((t as any).profiles);
      if (!profile?.full_name) return null;
      return {
        id:         t.id,
        full_name:  profile.full_name,
        email:      profile.email ?? "",
        tsc_number: t.tsc_number ?? null,
      };
    })
    .filter((t): t is TeacherOption => t !== null)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  // ── 4. Shape assignments ───────────────────────────────────────────────────
  const assignments: AssignmentRow[] = (rawAssignments ?? [])
    .filter((a) => a.classes && a.teachers)
    .map((a) => ({
      id:            a.id,
      class_id:      a.class_id,
      academic_year: a.academic_year,
      classes: {
        grade:  a.classes!.grade,
        stream: a.classes!.stream,
      },
      teacher: {
        id:        a.teachers!.id,
        full_name: a.teachers!.profiles?.full_name ?? "Unknown",
        email:     a.teachers!.profiles?.email     ?? "",
      },
    }));

  // ── 5. Student counts ──────────────────────────────────────────────────────
  const studentCounts: Record<string, number> = {};
  studentRows?.forEach(({ current_grade }) => {
    studentCounts[current_grade] = (studentCounts[current_grade] ?? 0) + 1;
  });

  // ── 6. Shape classes ───────────────────────────────────────────────────────
  const classes: ClassRecord[] = (rawClasses ?? []).map((c) => ({
    id:     c.id,
    grade:  c.grade,
    stream: c.stream,
  }));

  return (
    <ClassTeacherClient
      teachers={teachers}
      classes={classes}
      assignments={assignments}
      studentCounts={studentCounts}
      academicYear={activeYear}
    />
  );
}