import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BaseRole, AdminRole } from "@/lib/types/auth";

export interface StaffMember {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  phone_number: string | null;
  base_role: BaseRole;
  admin_role: AdminRole | null;
  roles: BaseRole[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get all staff members with their current roles
 * Only accessible by Super Admin
 */
export async function getAllStaffMembers(): Promise<StaffMember[] | null> {
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Verify Super Admin
  const { data: actor } = await supabase
    .from("profiles")
    .select("admin_role")
    .eq("id", user.id)
    .single();

  if (actor?.admin_role !== "super_admin") {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      avatar_url,
      base_role,
      admin_role,
      roles,
      created_at,
      updated_at,
      users (
        email,
        phone_number
      )
    `)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("getAllStaffMembers error:", error);
    return null;
  }

  if (!data) return [];

  // Strictly typed transformation
  return data.map((item) => ({
    id: item.id,
    full_name: item.full_name,
    avatar_url: item.avatar_url,
    email: item.users?.email ?? null,
    phone_number: item.users?.phone_number ?? null,
    base_role: item.base_role,
    admin_role: item.admin_role,
    roles: item.roles,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

/**
 * Get single staff member by ID
 */
export async function getStaffMemberById(id: string): Promise<StaffMember | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id,
      full_name,
      avatar_url,
      base_role,
      admin_role,
      roles,
      created_at,
      updated_at,
      users (
        email,
        phone_number
      )
    `)
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    full_name: data.full_name,
    avatar_url: data.avatar_url,
    email: data.users?.email ?? null,
    phone_number: data.users?.phone_number ?? null,
    base_role: data.base_role,
    admin_role: data.admin_role,
    roles: data.roles,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

/**
 * Get role statistics
 */
export async function getRoleStatistics() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("base_role, admin_role");

  if (error || !data) {
    return { total: 0, byBaseRole: {} as Record<BaseRole, number>, byAdminRole: {} as Record<string, number> };
  }

  const byBaseRole = data.reduce<Record<BaseRole, number>>(
    (acc, curr) => {
      const role = curr.base_role as BaseRole;
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    },
    {} as Record<BaseRole, number>
  );

  const byAdminRole = data.reduce<Record<string, number>>((acc, curr) => {
    if (curr.admin_role) {
      acc[curr.admin_role] = (acc[curr.admin_role] || 0) + 1;
    }
    return acc;
  }, {});

  return {
    total: data.length,
    byBaseRole,
    byAdminRole,
  };
}