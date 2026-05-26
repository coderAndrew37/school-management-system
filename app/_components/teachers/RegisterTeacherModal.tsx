// components/modals/RegisterTeacherModal.tsx
import React from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RegisterTeacherModalClient } from "./RegisterTeacherModalClient";

export default async function RegisterTeacherModal() {
  const supabase = await createSupabaseServerClient();

  // Read the active administrator's school context securely on the server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const schoolId = user?.app_metadata?.school_id as string | undefined;

  // Fallback database read if claims have not yet refreshed
  let resolvedSchoolId = schoolId || null;
  if (!resolvedSchoolId && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();
    resolvedSchoolId = profile?.school_id ?? null;
  }

  return <RegisterTeacherModalClient schoolId={resolvedSchoolId} />;
}