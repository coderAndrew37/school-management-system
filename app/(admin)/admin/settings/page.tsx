// app/(admin)/settings/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchSchoolSettings } from "@/lib/actions/settings";
import { getLogoPublicUrl } from "@/lib/utils/settings";
import { SchoolSettingsClient } from "./SchoolSettingsClient";

export const metadata = { title: "School Settings | Kibali Academy Admin" };
export const revalidate = 0;

export default async function SettingsPage() {
  const session = await getSession();
  
  if (!session || !session.profile) {
    redirect("/login?redirectTo=/admin/settings");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Protect the route using the updated BaseRole structural check
  if (base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  const settings = await fetchSchoolSettings();
  if (!settings) {
    return (
      <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 text-sm">Could not load settings.</p>
          <p className="text-white/20 text-xs mt-1">
            Ensure migration_009_school_settings.sql has been run.
          </p>
        </div>
      </div>
    );
  }

  const logoPublicUrl = getLogoPublicUrl(settings.logo_url);

  return (
    <SchoolSettingsClient settings={settings} logoPublicUrl={logoPublicUrl} />
  );
}