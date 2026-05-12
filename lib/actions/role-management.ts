"use server";

// @/lib/actions/role-management.ts
// Full CRUD:
//   A) User role assignment / revocation (Super Admin assigns roles to staff)
//   B) Role definition management (Super Admin creates / edits / deactivates role types)

import { createSupabaseServerClient }         from "@/lib/supabase/server";
import { supabaseAdmin }                       from "@/lib/supabase/admin";
import type {
  BaseRole,
  StaffMember,
  RoleStatistics,
  AdminRoleDefinition,
  AssignRolePayload,
  RoleDefinitionPayload,
}                                              from "@/lib/types/auth";
import { isSuperAdmin }                        from "./auth-utils";
import { revalidatePath }                      from "next/cache";
import { sendRoleAssignmentNotification }      from "../mail";

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getVerifiedSuperAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, actor: null };

  const { data: actor } = await supabase
    .from("profiles")
    .select("base_role, admin_role")
    .eq("id", user.id)
    .single();

  return { supabase, user: isSuperAdmin(actor) ? user : null, actor };
}

async function buildEmailMap(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!userIds.length) return map;
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const idSet = new Set(userIds);
  for (const u of data?.users ?? []) {
    if (idSet.has(u.id) && u.email) map.set(u.id, u.email);
  }
  return map;
}

function invalidate(...paths: string[]) {
  for (const p of paths) revalidatePath(p, "page");
}

type ActionResult = { success: boolean; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// ── A. USER ROLE ASSIGNMENT / REVOCATION ─────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// READ — all staff
export async function getAllStaffWithRoles(): Promise<StaffMember[] | null> {
  const { supabase, user } = await getVerifiedSuperAdmin();
  if (!user) return null;

  const [profilesResult, defsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, base_role, admin_role, roles, created_at, updated_at")
      .order("full_name", { ascending: true }),
    supabase
      .from("admin_role_definitions")
      .select("*")
      .eq("is_active", true),
  ]);

  if (profilesResult.error) {
    console.error("[getAllStaffWithRoles]", profilesResult.error.message);
    return null;
  }

  const data = profilesResult.data ?? [];
  const defs = (defsResult.data ?? []) as AdminRoleDefinition[];
  const defMap = new Map(defs.map((d) => [d.id, d]));
  const emailMap = await buildEmailMap(data.map((r) => r.id));

  return data.map((row) => ({
    id:                    row.id,
    full_name:             row.full_name   ?? null,
    avatar_url:            row.avatar_url  ?? null,
    email:                 emailMap.get(row.id) ?? null,
    base_role:             row.base_role   as BaseRole,
    admin_role:            row.admin_role  ?? null,
    admin_role_definition: row.admin_role ? (defMap.get(row.admin_role) ?? null) : null,
    roles:                 (row.roles as string[]) ?? null,
    created_at:            row.created_at,
    updated_at:            row.updated_at,
  }));
}

// READ — single staff member
export async function getStaffMemberById(id: string): Promise<StaffMember | null> {
  const supabase = await createSupabaseServerClient();

  const [profileResult, defsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, base_role, admin_role, roles, created_at, updated_at")
      .eq("id", id)
      .single(),
    supabase
      .from("admin_role_definitions")
      .select("*")
      .eq("is_active", true),
  ]);

  if (profileResult.error || !profileResult.data) return null;
  const row  = profileResult.data;
  const defs = (defsResult.data ?? []) as AdminRoleDefinition[];
  const defMap = new Map(defs.map((d) => [d.id, d]));
  const emailMap = await buildEmailMap([id]);

  return {
    id:                    row.id,
    full_name:             row.full_name   ?? null,
    avatar_url:            row.avatar_url  ?? null,
    email:                 emailMap.get(id) ?? null,
    base_role:             row.base_role   as BaseRole,
    admin_role:            row.admin_role  ?? null,
    admin_role_definition: row.admin_role ? (defMap.get(row.admin_role) ?? null) : null,
    roles:                 (row.roles as string[]) ?? null,
    created_at:            row.created_at,
    updated_at:            row.updated_at,
  };
}

// READ — statistics
export async function getRoleStatistics(): Promise<RoleStatistics> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("profiles").select("base_role, admin_role");

  const empty: RoleStatistics = { total: 0, byBaseRole: {}, byAdminRole: {} };
  if (!data) return empty;

  const byBaseRole  = data.reduce<Partial<Record<BaseRole, number>>>((acc, r) => {
    const role = r.base_role as BaseRole;
    acc[role] = (acc[role] ?? 0) + 1;
    return acc;
  }, {});

  const byAdminRole = data.reduce<Record<string, number>>((acc, r) => {
    if (r.admin_role) acc[r.admin_role] = (acc[r.admin_role] ?? 0) + 1;
    return acc;
  }, {});

  return { total: data.length, byBaseRole, byAdminRole };
}

// UPDATE — assign or revoke a role
export async function assignRoleAction(payload: AssignRolePayload): Promise<ActionResult> {
  const { user, supabase } = await getVerifiedSuperAdmin();
  if (!user) return { success: false, message: "Unauthorized. Super Admin access required." };

  const { targetUserId, base_role, admin_role, reason } = payload;

  if (!targetUserId) return { success: false, message: "Target user ID is required." };

  // Guard: super admin cannot demote themselves
  if (targetUserId === user.id && base_role !== "admin") {
    return { success: false, message: "You cannot demote your own account." };
  }
  if (targetUserId === user.id && admin_role !== "super_admin") {
    return { success: false, message: "You cannot remove your own Super Admin title." };
  }

  // Validate admin_role exists in definitions (if provided)
  if (admin_role) {
    const { data: def } = await supabase
      .from("admin_role_definitions")
      .select("id, is_active")
      .eq("id", admin_role)
      .single();

    if (!def) return { success: false, message: `Role "${admin_role}" does not exist.` };
    if (!def.is_active) return { success: false, message: `Role "${admin_role}" is currently deactivated.` };
  }

  if (base_role === "admin" && !admin_role) {
    return { success: false, message: "An administrative title is required for administrator accounts." };
  }

  try {
    // Snapshot before
    const { data: before } = await supabase
      .from("profiles")
      .select("full_name, base_role, admin_role, roles")
      .eq("id", targetUserId)
      .single();

    const newRoles = [base_role];

    const { error } = await supabase
      .from("profiles")
      .update({
        base_role,
        admin_role: base_role === "admin" ? (admin_role ?? null) : null,
        roles:      newRoles,
      })
      .eq("id", targetUserId);

    if (error) {
      console.error("[assignRoleAction] update error:", error.message);
      return { success: false, message: "Failed to update role. Please try again." };
    }

    // Audit log (non-blocking)
    supabaseAdmin.from("role_audit_logs").insert({
      actor_id:        user.id,
      target_id:       targetUserId,
      action:          admin_role ? "role_assigned" : "role_revoked",
      previous_values: { base_role: before?.base_role, admin_role: before?.admin_role },
      new_values:      { base_role, admin_role: admin_role ?? null },
      reason:          reason || "Role change by Super Admin",
    }).then(({ error: e }) => { if (e) console.warn("[audit]", e.message); });

    // Notification email (non-blocking)
    if (before?.full_name) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      const email = authUser?.user?.email;
      if (email) {
        sendRoleAssignmentNotification({
          recipientEmail: email,
          recipientName:  before.full_name,
          newRole:        admin_role ?? base_role,
          baseRole:       base_role,
          adminRole:      admin_role ?? undefined,
          reason,
        }).catch(console.error);
      }
    }

    invalidate("/admin/staff", `/admin/staff/${targetUserId}`);
    return { success: true, message: admin_role ? "Role assigned successfully." : "Role revoked successfully." };
  } catch (err) {
    console.error("[assignRoleAction] unexpected:", err);
    return { success: false, message: "An unexpected error occurred." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ── B. ROLE DEFINITION CRUD ──────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// READ — all role definitions (active + inactive)
export async function getAllRoleDefinitions(): Promise<AdminRoleDefinition[]> {
  const { user, supabase } = await getVerifiedSuperAdmin();
  if (!user) return [];

  const { data, error } = await supabase
    .from("admin_role_definitions")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getAllRoleDefinitions]", error.message);
    return [];
  }
  return (data ?? []) as AdminRoleDefinition[];
}

// READ — active only (for select menus in role assignment)
export async function getActiveRoleDefinitions(): Promise<AdminRoleDefinition[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_role_definitions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getActiveRoleDefinitions]", error.message);
    return [];
  }
  return (data ?? []) as AdminRoleDefinition[];
}

// CREATE — new role definition
export async function createRoleDefinitionAction(
  payload: RoleDefinitionPayload
): Promise<ActionResult> {
  const { user } = await getVerifiedSuperAdmin();
  if (!user) return { success: false, message: "Unauthorized." };

  const { id, label, description, allowed_paths, sort_order } = payload;

  // Check for duplicate
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("admin_role_definitions")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (existing) {
    return { success: false, message: `A role with ID "${id}" already exists.` };
  }

  const { error } = await supabaseAdmin
    .from("admin_role_definitions")
    .insert({ id, label, description, allowed_paths, sort_order, is_active: true });

  if (error) {
    console.error("[createRoleDefinitionAction]", error.message);
    return { success: false, message: "Failed to create role definition." };
  }

  // Audit log
  supabaseAdmin.from("role_audit_logs").insert({
    actor_id:        user.id,
    target_id:       user.id,          // no user target for definition ops
    action:          "role_def_created",
    previous_values: {},
    new_values:      { id, label, allowed_paths },
    reason:          `New role definition: ${label}`,
  }).then(({ error: e }) => { if (e) console.warn("[audit]", e.message); });

  invalidate("/admin/staff");
  return { success: true, message: `Role "${label}" created successfully.` };
}

// UPDATE — edit label, description, paths, sort_order, is_active
export async function updateRoleDefinitionAction(
  id: string,
  payload: Omit<RoleDefinitionPayload, "id"> & { is_active: boolean }
): Promise<ActionResult> {
  const { user } = await getVerifiedSuperAdmin();
  if (!user) return { success: false, message: "Unauthorized." };

  if (id === "super_admin") {
    return { success: false, message: "The Super Administrator role cannot be modified." };
  }

  const supabase = await createSupabaseServerClient();

  // Snapshot before
  const { data: before } = await supabase
    .from("admin_role_definitions")
    .select("*")
    .eq("id", id)
    .single();

  if (!before) return { success: false, message: `Role "${id}" not found.` };

  const { error } = await supabaseAdmin
    .from("admin_role_definitions")
    .update({
      label:         payload.label,
      description:   payload.description,
      allowed_paths: payload.allowed_paths,
      sort_order:    payload.sort_order,
      is_active:     payload.is_active,
    })
    .eq("id", id);

  if (error) {
    console.error("[updateRoleDefinitionAction]", error.message);
    return { success: false, message: "Failed to update role definition." };
  }

  // If paths changed, app_metadata on all users with this role is now stale.
  // Re-trigger the sync by touching their admin_role column.
  if (JSON.stringify(before.allowed_paths) !== JSON.stringify(payload.allowed_paths)) {
    await supabaseAdmin
      .from("profiles")
      .update({ admin_role: id })  // same value — triggers the AFTER UPDATE trigger
      .eq("admin_role", id);
  }

  // Audit log
  supabaseAdmin.from("role_audit_logs").insert({
    actor_id:        user.id,
    target_id:       user.id,
    action:          "role_def_updated",
    previous_values: before,
    new_values:      { id, ...payload },
    reason:          `Role definition updated: ${id}`,
  }).then(({ error: e }) => { if (e) console.warn("[audit]", e.message); });

  invalidate("/admin/staff");
  return { success: true, message: `Role "${payload.label}" updated successfully.` };
}

// DEACTIVATE — soft delete (ON DELETE SET NULL in profiles FK handles cleanup)
// We never hard-delete because the audit log references role IDs.
export async function deactivateRoleDefinitionAction(
  id: string,
  reason: string
): Promise<ActionResult> {
  const { user } = await getVerifiedSuperAdmin();
  if (!user) return { success: false, message: "Unauthorized." };

  if (id === "super_admin") {
    return { success: false, message: "The Super Administrator role cannot be deactivated." };
  }

  // Count affected users BEFORE deactivation so we can warn in the UI
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("admin_role", id);

  const { error } = await supabaseAdmin
    .from("admin_role_definitions")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    console.error("[deactivateRoleDefinitionAction]", error.message);
    return { success: false, message: "Failed to deactivate role." };
  }

  // The FK ON DELETE SET NULL will clear admin_role on profiles automatically
  // when a hard-delete happens, but since we're doing a soft-delete (is_active=false),
  // we manually clear admin_role for all affected users so they don't
  // hold a reference to a disabled role.
  await supabaseAdmin
    .from("profiles")
    .update({ admin_role: null })
    .eq("admin_role", id);

  // Audit
  supabaseAdmin.from("role_audit_logs").insert({
    actor_id:        user.id,
    target_id:       user.id,
    action:          "role_def_deactivated",
    previous_values: { id, affected_users: count ?? 0 },
    new_values:      { id, is_active: false },
    reason:          reason || `Role deactivated: ${id}`,
  }).then(({ error: e }) => { if (e) console.warn("[audit]", e.message); });

  invalidate("/admin/staff");
  return {
    success: true,
    message: `Role deactivated.${(count ?? 0) > 0 ? ` ${count} staff member(s) will need role reassignment.` : ""}`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── C. AUDIT LOG READ ────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id:              string;
  actor_id:        string;
  target_id:       string;
  action:          string;
  previous_values: Record<string, unknown>;
  new_values:      Record<string, unknown>;
  reason:          string | null;
  created_at:      string;
}

export async function getRoleAuditLog(targetUserId: string): Promise<AuditLogEntry[]> {
  const { user } = await getVerifiedSuperAdmin();
  if (!user) return [];

  const { data, error } = await supabaseAdmin
    .from("role_audit_logs")
    .select("*")
    .eq("target_id", targetUserId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) { console.error("[getRoleAuditLog]", error.message); return []; }
  return (data ?? []) as AuditLogEntry[];
}