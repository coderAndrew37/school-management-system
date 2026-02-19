import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "../_components/auth/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set New Password | Kibali Academy",
};

export default async function ResetPasswordPage() {
  // Only allow access if the user has a valid recovery session
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // No valid session — the reset link may have expired
    redirect("/forgot-password?error=expired");
  }

  return <ResetPasswordForm />;
}
