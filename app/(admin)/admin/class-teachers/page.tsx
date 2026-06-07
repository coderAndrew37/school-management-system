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
// These are what Supabase returns from the joined select — we shape them
// into the clean client types before passing them as props.

interface RawTeacherRow {
  id: string;
  tsc_number: string | null;
  profiles: {
    full_name: string;
    email:     string | null;
  } | null;
}

interface RawAssignmentRow {
  id:           string;
  class_id:     string;
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

export default async function ClassTeachersPage() {
  const session = await getSession();

  if (!session?.profile) redirect("/login");

  // profiles.base_role is the correct column (not role)
  const { base_role, is_super_admin, is_dev, school_id } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  if (base_role !== "admin" && !isPlatformAdmin) redirect("/dashboard");

  if (!school_id) redirect("/login"); // admin must have a school

  const supabase = await createSupabaseServerClient();

  // ── 1. Academic year from system settings ──────────────────────────────────
  const { data: settings } = await supabase
    .from("system_settings")
    .select("current_academic_year")
    .eq("id", 1)
    .single();

  const activeYear = settings?.current_academic_year ?? 2026;

  // ── 2. Classes — scoped to this school + year ──────────────────────────────
  const { data: rawClasses } = await supabase
    .from("classes")
    .select("id, grade, stream")
    .eq("school_id",    school_id)
    .eq("academic_year", activeYear)
    .order("grade");

 // 1. Define the precise shape Supabase returns for the join
interface SupabaseTeacherJoin {
  id: string;
  tsc_number: string | null;
  profiles: {
    full_name: string;
    email: string | null;
  } | {
    full_name: string;
    email: string | null;
  }[] | null; 
  // Captures both object and array variations safely without using 'any'
}

// ── 3. Teachers — strictly typed ───────────────────────────────────────────
const { data: rawTeachers } = await supabase
  .from("teachers")
  .select("id, tsc_number, profiles ( full_name, email )")
  .eq("school_id", school_id)
  .eq("status",    "active");

const teachers: TeacherOption[] = ((rawTeachers as unknown as SupabaseTeacherJoin[]) ?? [])
  .map((t) => {
    // Narrow down the union type safely using a type guard
    const profile = Array.isArray(t.profiles) ? t.profiles[0] : t.profiles;
    
    if (!profile || !profile.full_name) return null;

    return {
      id:         t.id,
      full_name:  profile.full_name,
      email:      profile.email ?? "",
      tsc_number: t.tsc_number,
    };
  })
  .filter((t): t is TeacherOption => t !== null)
  .sort((a, b) => a.full_name.localeCompare(b.full_name));
  
  // ── 4. Active assignments — scoped to school + year ───────────────────────
  // teachers join also goes via profiles since full_name isn't on teachers
  const { data: rawAssignments } = await supabase
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
    .returns<RawAssignmentRow[]>();

  // Shape into the clean AssignmentRow the client expects
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

  // ── 5. Student counts — scoped to this school ─────────────────────────────
  const { data: studentRows } = await supabase
    .from("students")
    .select("current_grade")
    .eq("school_id", school_id);

  const studentCounts: Record<string, number> = {};
  studentRows?.forEach((row) => {
    studentCounts[row.current_grade] =
      (studentCounts[row.current_grade] ?? 0) + 1;
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