// app/admin/admit/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import AdmissionForm from "@/app/_components/AdmissionForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function AdmissionPage() {
  const session = await getSession();

  if (!session || !session.profile) {
    redirect("/login?redirectTo=/admin/admit");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Validate authorization against both the explicit enum base_role and the platform admin flags
  if (base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  const currentYear = new Date().getFullYear();
  
  // Use the admin client to bypass school-scoped RLS gates if the user is a Super Admin
  const clientInstance = isPlatformAdmin ? supabaseAdmin : await createSupabaseServerClient();

  // If the user is a regular school admin, scope classes explicitly to their school context
  let query = clientInstance
    .from("classes")
    .select("id, grade, stream")
    .eq("academic_year", currentYear);

  if (!isPlatformAdmin && session.profile.school_id) {
    query = query.eq("school_id", session.profile.school_id);
  }

  const { data: classes, error } = await query.order("grade", { ascending: true });

  if (error) {
    console.error("[AdmissionPage] Failed to fetch available classes:", error.message);
  }

  return <AdmissionForm availableClasses={classes ?? []} />;
}