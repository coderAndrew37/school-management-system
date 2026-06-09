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

  if (base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  const settings = await fetchSchoolSettings();

if (!settings) {
  // Only reachable if both the fetch AND auto-provision failed (DB unreachable, RLS block, etc.)
  return (
    <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center">
      <div className="text-center">
        <p className="text-white/40 text-sm">School settings could not be loaded.</p>
        <p className="text-white/20 text-xs mt-1">
          This may be a database connectivity issue. Try refreshing, or contact support.
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