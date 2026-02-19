import { createServerClient } from "@/lib/supabase/client";
import { Student, Teacher, DashboardStats } from "@/lib/types/dashboard";

export async function fetchStudents(): Promise<Student[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("students")
    .select(
      `
      id,
      readable_id,
      upi_number,
      full_name,
      date_of_birth,
      gender,
      current_grade,
      parent_id,
      created_at,
      parents (
        full_name,
        phone_number
      )
    `,
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchStudents error:", error);
    return [];
  }

  return (data ?? []) as Student[];
}

export async function fetchTeachers(): Promise<Teacher[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, tsc_number, email, phone_number, created_at")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("fetchTeachers error:", error);
    return [];
  }

  return (data ?? []) as Teacher[];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const supabase = createServerClient();

  const [studentsCount, teachersCount, parentsCount] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("teachers").select("id", { count: "exact", head: true }),
    supabase.from("parents").select("id", { count: "exact", head: true }),
  ]);

  return {
    totalStudents: studentsCount.count ?? 0,
    totalTeachers: teachersCount.count ?? 0,
    totalParents: parentsCount.count ?? 0,
  };
}
