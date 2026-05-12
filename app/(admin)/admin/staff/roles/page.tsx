// @/app/admin/staff/page.tsx

import { redirect }                   from "next/navigation";
import type { Metadata }              from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSuperAdmin }               from "@/lib/actions/auth-utils";
import {
  getAllStaffWithRoles,
  getAllRoleDefinitions,
  getRoleStatistics,
}                                     from "@/lib/actions/role-management";
import { RoleManagementClient }       from "./page.client";

export const metadata: Metadata = {
  title: "Role Management — Kibali Academy",
};

export default async function RoleManagementPage() {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("base_role, admin_role")
    .eq("id", user.id)
    .single();

  if (!isSuperAdmin(actorProfile)) redirect("/admin/dashboard");

  // All three fetches run in parallel
  const [staff, roleDefs, stats] = await Promise.all([
    getAllStaffWithRoles(),
    getAllRoleDefinitions(),
    getRoleStatistics(),
  ]);

  return (
    <div className="space-y-8 px-1">
      <div>
        <h1 className="text-2xl font-semibold text-stone-900 tracking-tight">Role Management</h1>
        <p className="mt-1 text-sm text-stone-500 max-w-lg">
          Assign administrative titles and base roles to control what each staff member
          can access. Role definitions can be created, edited, or deactivated below.
        </p>
      </div>

      <RoleManagementClient
        initialStaff={staff ?? []}
        roleDefs={roleDefs}
        stats={stats}
        currentUserId={user.id}
      />
    </div>
  );
}