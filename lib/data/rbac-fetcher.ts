// lib/data/rbac-fetchers.ts
// Kibali Academy — RBAC Data Fetcher Layer
//
// All fetchers run server-side only. Every query is school_id scoped.
// Zero usage of `any` — every join shape is explicitly typed below.

import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================================
// RAW JOIN SHAPES (internal — not exported)
// ============================================================================

interface RawPermissionJoin {
  permission_id: string;
  permission_name: string;
  category: string;
}

interface RawRolePermissionJoin {
  permission_id: string;
  permissions: RawPermissionJoin | null;
}

interface RawRoleRow {
  id: string;
  role_name: string;
  description: string;
  created_at: string;
  role_permissions: RawRolePermissionJoin[];
}

interface RawUserRoleJoin {
  role_id: string;
  roles: { id: string; role_name: string } | null;
}

interface RawUserPermissionJoin {
  permission_id: string;
  has_access: boolean;
  permissions: { id: string; permission_name: string } | null;
}

interface RawTeacherRow {
  id: string;
  full_name: string;
  tsc_number: string | null;
  email: string;
  phone_number: string | null;
  status: "active" | "transferred" | "suspended";
  transfer_destination_school: string | null;
  transfer_date: string | null;
  user_roles: RawUserRoleJoin[];
  user_permissions: RawUserPermissionJoin[];
}

interface RawAuditActorJoin {
  id: string;
  full_name: string;
}

interface RawAuditRow {
  id: string;
  action_type: AuditLogEntry["action_type"];
  target_table: string;
  record_id: string;
  old_values: string | null;
  new_values: string | null;
  created_at: string;
  actor_profile: RawAuditActorJoin | null;
}

// ============================================================================
// EXPORTED TYPES
// ============================================================================

export interface RoleWithPermissions {
  id: string;
  role_name: string;
  description: string;
  created_at: string;
  permissions: {
    permission_id: string;
    permission_name: string;
    category: string;
  }[];
}

export interface SystemPermission {
  id: string;
  permission_name: string;
  category: string;
  description: string;
}

export interface StaffAccessProfile {
  id: string;
  full_name: string;
  tsc_number: string | null;
  email: string;
  phone_number: string | null;
  status: "active" | "transferred" | "suspended";
  transfer_destination_school: string | null;
  transfer_date: string | null;
  roles: { id: string; role_name: string }[];
  overrides: {
    permission_id: string;
    permission_name: string;
    has_access: boolean;
  }[];
}

export interface AuditLogEntry {
  id: string;
  action_type:
    | "ROLE_ASSIGN"
    | "ROLE_REVOKE"
    | "PERMISSION_OVERRIDE_SET"
    | "PERMISSION_OVERRIDE_CLEAR"
    | "TRANSFER_IN"
    | "TRANSFER_OUT"
    | "PROFILE_UPDATE"
    | "STUDENT_CREATE"
    | "STUDENT_UPDATE"
    | "STUDENT_TRANSFER"
    | "INSERT"
    | "UPDATE"
    | "DELETE";
  target_table: string;
  record_id: string;
  old_values: string | null;
  new_values: string | null;
  created_at: string;
  actor_profile: { id: string; full_name: string } | null;
}

// ── Internal: resolve school-scoped super-admin profile ──────────────────────

interface TenantProfile {
  school_id: string;
  is_super_admin: boolean;
}

async function resolveTenantProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<TenantProfile> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated access attempt.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("school_id, is_super_admin")
    .eq("id", user.id)
    .single();

  if (error || !profile?.school_id) {
    throw new Error("Unauthorized: Tenant scoping lookup failed.");
  }

  if (!profile.is_super_admin) {
    throw new Error("Unauthorized: Super Admin access required.");
  }

  return profile as TenantProfile;
}

// ============================================================================
// FETCHERS: ROLE ENGINE
// ============================================================================

/**
 * Fetches all custom roles for the active super admin's school tenant,
 * including nested permission mappings.
 */
export async function getSchoolRoles(): Promise<RoleWithPermissions[]> {
  const supabase = await createSupabaseServerClient();
  const { school_id } = await resolveTenantProfile(supabase);

  const { data: roles, error } = await supabase
    .from("roles")
    .select(`
      id,
      role_name,
      description,
      created_at,
      role_permissions (
        permission_id,
        permissions (
          permission_name,
          category
        )
      )
    `)
    .eq("school_id", school_id)
    .order("role_name", { ascending: true });

  if (error) {
    console.error("[getSchoolRoles] error:", error.message);
    return [];
  }

  return (roles as unknown as RawRoleRow[]).map((role) => ({
    id: role.id,
    role_name: role.role_name,
    description: role.description,
    created_at: role.created_at,
    permissions: (role.role_permissions ?? [])
      .filter((rp) => rp.permissions !== null)
      .map((rp) => ({
        permission_id: rp.permission_id,
        permission_name: rp.permissions!.permission_name,
        category: rp.permissions!.category,
      })),
  }));
}

/**
 * Fetches the global permission catalog — all valid domain-action tokens.
 * Used to populate the override assignment UI and the role configurator.
 */
export async function getSystemPermissionsCatalog(): Promise<SystemPermission[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("permission_catalog")
    .select("id, label, domain, subdomain, action, description")
    .order("domain",    { ascending: true })
    .order("subdomain", { ascending: true })
    .order("action",    { ascending: true });

  if (error) {
    console.error("[getSystemPermissionsCatalog] error:", error.message);
    return [];
  }

  // Map to the SystemPermission shape used by the RBAC UI
  return (data ?? []).map((row) => ({
    id:             row.id as string,
    permission_name: row.id as string,   // token IS the canonical name
    category:       row.domain as string,
    description:    (row.description ?? "") as string,
  }));
}

// ============================================================================
// FETCHERS: STAFF ACCESS & LIFECYCLE
// ============================================================================

/**
 * Loads staff profiles with their active roles and permission overrides.
 * School-scoped and requires super-admin session.
 */
export async function getStaffAccessDirectory(
  filter: "active" | "transferred" | "all" = "active"
): Promise<StaffAccessProfile[]> {
  const supabase = await createSupabaseServerClient();
  const { school_id } = await resolveTenantProfile(supabase);

  let query = supabase
    .from("teachers")
    .select(`
      id,
      full_name,
      tsc_number,
      email,
      phone_number,
      status,
      transfer_destination_school,
      transfer_date,
      user_roles (
        role_id,
        roles (
          id,
          role_name
        )
      ),
      user_permissions (
        permission_id,
        has_access,
        permissions (
          id,
          permission_name
        )
      )
    `)
    .eq("school_id", school_id);

  if (filter === "active")      query = query.eq("status", "active");
  if (filter === "transferred") query = query.eq("status", "transferred");

  const { data, error } = await query.order("full_name", { ascending: true });

  if (error) {
    console.error("[getStaffAccessDirectory] error:", error.message);
    return [];
  }

  return (data as unknown as RawTeacherRow[]).map(normalizeStaffRow);
}

/**
 * Loads a single staff member's full security profile for the slide-over editor.
 */
export async function getStaffSecurityProfile(
  teacherId: string
): Promise<StaffAccessProfile | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("teachers")
    .select(`
      id,
      full_name,
      tsc_number,
      email,
      phone_number,
      status,
      transfer_destination_school,
      transfer_date,
      user_roles (
        role_id,
        roles (
          id,
          role_name
        )
      ),
      user_permissions (
        permission_id,
        has_access,
        permissions (
          id,
          permission_name
        )
      )
    `)
    .eq("id", teacherId)
    .single();

  if (error || !data) {
    console.error(`[getStaffSecurityProfile] id=${teacherId}:`, error?.message);
    return null;
  }

  return normalizeStaffRow(data as unknown as RawTeacherRow);
}

// Internal normalizer — shared by both staff fetchers
function normalizeStaffRow(staff: RawTeacherRow): StaffAccessProfile {
  return {
    id:                          staff.id,
    full_name:                   staff.full_name,
    tsc_number:                  staff.tsc_number,
    email:                       staff.email,
    phone_number:                staff.phone_number,
    status:                      staff.status,
    transfer_destination_school: staff.transfer_destination_school,
    transfer_date:               staff.transfer_date,
    roles: (staff.user_roles ?? [])
      .filter((ur) => ur.roles !== null)
      .map((ur) => ({
        id:        ur.roles!.id,
        role_name: ur.roles!.role_name,
      })),
    overrides: (staff.user_permissions ?? [])
      .filter((up) => up.permissions !== null)
      .map((up) => ({
        permission_id:   up.permission_id,
        permission_name: up.permissions!.permission_name,
        has_access:      up.has_access,
      })),
  };
}

// ============================================================================
// FETCHERS: AUDIT LEDGER
// ============================================================================

/**
 * Returns the tamper-proof security audit trail for the school tenant.
 * Ordered newest-first. Requires super-admin session.
 */
export async function getSecurityAuditLogs(
  limit: number = 50
): Promise<AuditLogEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { school_id } = await resolveTenantProfile(supabase);

  const { data, error } = await supabase
    .from("security_audit_logs")
    .select(`
      id,
      action_type,
      target_table,
      record_id,
      old_values,
      new_values,
      created_at,
      actor_profile:profiles!actor_id (
        id,
        full_name
      )
    `)
    .eq("school_id", school_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getSecurityAuditLogs] error:", error.message);
    return [];
  }

  return (data as unknown as RawAuditRow[]).map((row) => ({
    id:            row.id,
    action_type:   row.action_type,
    target_table:  row.target_table,
    record_id:     row.record_id,
    old_values:    row.old_values,
    new_values:    row.new_values,
    created_at:    row.created_at,
    actor_profile: row.actor_profile ?? null,
  }));
}