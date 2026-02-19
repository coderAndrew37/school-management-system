import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROLE_ROUTES } from "@/lib/types/auth";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  // 1. Check if user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2. If not logged in, send them to the beautiful login page you just built
  if (!user) {
    redirect("/login");
  }

  // 3. If logged in, fetch their role to know which portal to open
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "parent";

  // 4. Redirect to /admin/dashboard, /teacher/grading, etc.
  // ROLE_ROUTES should be { admin: '/admin/dashboard', teacher: '/teacher/grading', parent: '/parent/dashboard' }
  redirect(ROLE_ROUTES[role as keyof typeof ROLE_ROUTES] || "/login");
}
