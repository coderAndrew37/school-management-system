// app/admin/admit/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import AdmissionForm from "@/app/_components/AdmissionForm";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdmissionPage() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login?redirectTo=/admin/admit");
  }

  // Fetch classes on the server
  const supabase = await createSupabaseServerClient();
  const currentYear = new Date().getFullYear();

  const { data: classes } = await supabase
    .from("classes")
    .select("id, grade, stream")
    .eq("academic_year", currentYear)
    .order("grade", { ascending: true });

  return <AdmissionForm availableClasses={classes ?? []} />;
}