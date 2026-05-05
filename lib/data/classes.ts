import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function fetchClasses() {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("classes")
    .select("id, grade, stream")
    .eq("academic_year", 2026)
    .order("grade", { ascending: true });

  if (error) throw new Error("Failed to fetch classes");
  return data || [];
}