import { createServerClient } from "@/lib/supabase/client";
import {
  Student,
  Teacher,
  DashboardStats,
  Parent,
} from "@/lib/types/dashboard";

export async function fetchStudents(limit?: number): Promise<Student[]> {
  const supabase = createServerClient();

  let query = supabase
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

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchStudents error:", error);
    return [];
  }

  return (data ?? []) as Student[];
}

export async function fetchAllStudents({
  search = "",
  grade = "",
  gender = "",
  sortBy = "created_at",
  sortDir = "desc",
}: {
  search?: string;
  grade?: string;
  gender?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
} = {}): Promise<Student[]> {
  const supabase = createServerClient();

  let query = supabase
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
    .order(sortBy, { ascending: sortDir === "asc" });

  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,readable_id.ilike.%${search}%`,
    );
  }

  if (grade) {
    query = query.eq("current_grade", grade);
  }

  if (gender) {
    query = query.eq("gender", gender);
  }

  const { data, error } = await query;

  if (error) {
    console.error("fetchAllStudents error:", error);
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

export async function fetchParents(): Promise<Parent[]> {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("parents")
    .select("id, full_name, email, phone_number, created_at")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("fetchParents error:", error);
    return [];
  }
  return (data ?? []) as Parent[];
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
