// lib/actions/permissions.ts
"use server";

import { getSession } from "@/lib/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface PermissionCheck {
  hasAccess: boolean;
  schoolId: string;
  userId: string;
  isSuperAdmin: boolean;
}

/**
 * Resolves whether the current user has rights to execute a specific catalog operation.
 * Implements: SuperAdmin Bypass -> Direct Profile Overrides -> Custom Role Definition arrays
 */
export async function verifyUserPermission(permissionId: string): Promise<PermissionCheck> {
  const session = await getSession();
  if (!session || !session.profile?.school_id) {
    return { hasAccess: false, schoolId: "", userId: "", isSuperAdmin: false };
  }

  const profile = session.profile;
  const schoolId = profile.school_id as string;
  const userId = profile.id as string;

  // Tier 1: Global High-Privilege Flags
  if (profile.is_super_admin || profile.is_dev) {
    return { hasAccess: true, schoolId, userId, isSuperAdmin: true };
  }

  // Tier 2: Absolute Veto (Granular Profile Denied Array)
  if (profile.denied_permissions_override?.includes(permissionId)) {
    return { hasAccess: false, schoolId, userId, isSuperAdmin: false };
  }

  // Tier 2: Absolute Grant (Granular Profile Allowed Array)
  if (profile.allowed_permissions_override?.includes(permissionId)) {
    return { hasAccess: true, schoolId, userId, isSuperAdmin: false };
  }

  // Tier 3: Role Definitions Resolution (Match base_role against tenant definitions)
  const supabase = await createSupabaseServerClient();
  const { data: roleDef } = await supabase
    .from("admin_role_definitions")
    .select("baseline_permissions")
    .eq("school_id", schoolId)
    .eq("id", profile.base_role) // Matches user's active base_role mapping string
    .eq("is_active", true)
    .maybeSingle();

  if (roleDef?.baseline_permissions?.includes(permissionId)) {
    return { hasAccess: true, schoolId, userId, isSuperAdmin: false };
  }

  return { hasAccess: false, schoolId, userId, isSuperAdmin: false };
}