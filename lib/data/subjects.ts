import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code: string;
  level: "lower_primary" | "upper_primary" | "junior_secondary";
  weekly_lessons: number;
  created_at: string | null;
  knec_learning_area: string | null;
}

export async function getSchoolSubjects(schoolId: string): Promise<Subject[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("subjects")
    .select(
      "id, school_id, name, code, level, weekly_lessons, created_at, knec_learning_area"
    )
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (error) {
    console.error("[getSchoolSubjects] Supabase error:", error.message);
    throw new Error(`Failed to fetch subjects: ${error.message}`);
  }

  return (data ?? []) as Subject[];
}