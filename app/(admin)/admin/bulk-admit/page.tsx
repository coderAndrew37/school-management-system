import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { BulkAdmitClient } from "./BulkAdmitClient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Bulk Admission | Kibali Admin" };

export default async function BulkAdmitPage() {
  const session = await getSession();
  
  // 1. Auth Guard
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login");
  }

  // 2. Fetch classes for the dropdown in BulkAdmitClient
  const supabase = await createSupabaseServerClient();
  const { data: classesData } = await supabase
    .from("classes")
    .select("id, name")
    .order("name", { ascending: true });

  const classes = classesData ?? [];

  return <BulkAdmitClient classes={classes} />;
}