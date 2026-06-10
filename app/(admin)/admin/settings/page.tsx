// app/(admin)/settings/page.tsx

import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchSchoolSettings } from "@/lib/actions/settings";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SchoolSettingsClient } from "./SchoolSettingsClient";

export const metadata = { title: "School Settings | Kibali Academy Admin" };
export const revalidate = 0;

export default async function SettingsPage() {
  const session = await getSession();

  // 1. Authenticated Route Protection
  if (!session || !session.profile) {
    redirect("/login?redirectTo=/admin/settings");
  }

  const { base_role, is_super_admin, is_dev, school_id } = session.profile;
  const isPlatformAdmin = !!(is_super_admin || is_dev);

  // 2. Coarse Access Validation Gateway
  if (base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  // 3. Resolve Granular Catalog Permission Matrix for Client Tabs Rendering Engine
  let allowedCatalogPermissions: string[] = [];

  if (!isPlatformAdmin && school_id) {
    const supabase = await createSupabaseServerClient();
    
    // Fetch user's role-level base permission array matrix mapping
    const { data: roleDef } = await supabase
      .from("admin_role_definitions")
      .select("baseline_permissions")
      .eq("school_id", school_id)
      .eq("id", session.profile.base_role)
      .eq("is_active", true)
      .maybeSingle();

    let resolvedBase = roleDef?.baseline_permissions ?? [];

    // Layer profile direct overrides on top of the role definition
if (session.profile.allowed_permissions_override) {
  resolvedBase = [...new Set([...resolvedBase, ...session.profile.allowed_permissions_override])];
}
if (session.profile.denied_permissions_override) {
  // Explicitly type 'p' as a string to clear TS7006
  resolvedBase = resolvedBase.filter(
    (p: string) => !session.profile.denied_permissions_override?.includes(p)
  );
}

    allowedCatalogPermissions = resolvedBase;
  }

  // 4. Read / Provision settings data row configurations
  const settings = await fetchSchoolSettings();

  if (!settings) {
    return (
      <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 text-sm">School settings could not be loaded.</p>
          <p className="text-white/20 text-xs mt-1">
            This may be a database connectivity issue or active RLS block. Try refreshing.
          </p>
        </div>
      </div>
    );
  }

  // 5. Clean asset route verification (Safely unwrap or default to null)
  const logoPublicUrl = settings.logo_url ?? null;

  return (
    <SchoolSettingsClient 
      settings={settings} 
      logoPublicUrl={logoPublicUrl} 
      isSuperAdmin={isPlatformAdmin}
      allowedCatalogPermissions={allowedCatalogPermissions}
    />
  );
}