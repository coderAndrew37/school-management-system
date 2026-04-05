import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NewClassForm } from "./NewClassForm";

export default async function NewClassPage() {
  const supabase = await createSupabaseServerClient();

  const { data: settings } = await supabase
    .from("system_settings")
    .select("current_academic_year")
    .eq("id", 1)
    .single();

  const activeYear = settings?.current_academic_year ?? 2026;

  return <NewClassForm currentYear={activeYear} />;
}
