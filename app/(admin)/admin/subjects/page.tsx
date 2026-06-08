import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Subject } from "@/lib/data/subjects";
import { SubjectDashboard } from "@/app/_components/subjects/SubjectsDashboard";

export const metadata: Metadata = {
  title: "Subject Management | Dashboard",
  description: "Manage school subjects and CBC curriculum templates.",
};

export default async function SubjectsPage() {
  // 1. Authenticate user & extract school context securely on the server
  const session = await getSession();
  if (!session || !session.profile) {
    redirect("/auth/login");
  }

  const { school_id, base_role, is_super_admin, is_dev } = session.profile;
  const hasAccess = base_role === "admin" || is_super_admin || is_dev;

  if (!hasAccess || !school_id) {
    redirect("/dashboard");
  }

  // 2. Fetch subjects data from Supabase matching the authenticated school
  const { data: subjectsData, error } = await supabaseAdmin
    .from("subjects")
    .select("*")
    .eq("school_id", school_id)
    .order("level", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("[SubjectsPage] Fetch Error:", error.message);
  }

  const subjects = (subjectsData as Subject[]) ?? [];

  // 3. Render and pass the server-fetched state straight down
  return (
    <SubjectDashboard 
      schoolId={school_id} 
      initialSubjects={subjects} 
    />
  );
}