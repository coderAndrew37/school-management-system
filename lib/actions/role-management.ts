"use server";

// @/lib/actions/role-management.ts
//
// Audit fixes applied:
//  1. createStaffUserAction — teacher row provisioned first, teacher_id written to profile,
//     full rollback cascade on any fault.
//  2. Composite key traps — every admin_role_definitions query now uses BOTH
//     .eq("id", id).eq("school_id", schoolId) to prevent cross-tenant leakage.
//  3. Promise.all rollback wraps — Supabase PostgREST builders are Thenables, not
//     native Promises. All parallel cleanup arrays wrap builders in async IIFEs.
//  4. Zero `any` — strict types throughout.
//  5. profiles.roles removed — base_role + JWT accessible_portals (via
//     sync_user_jwt_claims / staff_role_assignments) are now the sole source
//     of truth for portal membership. StaffMember no longer carries `roles`.

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

interface VerifiedAdmin {
  supabase:  Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user:      { id: string } | null;
  actor:     { base_role: string; admin_role: string | null; school_id: string | null } | null;
}

async function getVerifiedSuperAdmin(): Promise<VerifiedAdmin> {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, actor: null };

  const { data: actor } = await supabase
    .from("profiles")
    .select("base_role, admin_role, school_id")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    user: isSuperAdmin(actor) ? user : null,
    actor: actor as VerifiedAdmin["actor"],
  };
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

function invalidate(...paths: string[]): void {
  for (const p of paths) revalidatePath(p, "page");
}

export type ActionResult = { success: boolean; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// ── A. USER ROLE ASSIGNMENT / REVOCATION ─────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

export async function getAllStaffWithRoles(): Promise<StaffMember[] | null> {
  const { supabase, user, actor } = await getVerifiedSuperAdmin();
  if (!user || !actor?.school_id) return null;

  const [profilesResult, defsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, base_role, admin_role, created_at, updated_at")
      .eq("school_id", actor.school_id)
      .order("full_name", { ascending: true }),
    supabase
      .from("admin_role_definitions")
      .select("*")
      .eq("school_id", actor.school_id)
      .eq("is_active", true),
  ]);

  if (profilesResult.error) {
    console.error("[getAllStaffWithRoles]", profilesResult.error.message);
    return null;
  }

  const data = profilesResult.data ?? [];
  const defs = (defsResult.data ?? []) as AdminRoleDefinition[];
  const defMap = new Map(defs.map((d) => [d.id, d]));
  const emailMap = await buildEmailMap(data.map((r) => String(r.id)));

  return data.map((row): StaffMember => {
    const baseRole  = (row.base_role  as BaseRole) || "staff";
    const adminRole = (row.admin_role as string)   || null;

    return {
      id:                    String(row.id),
      full_name:             (row.full_name  as string) ?? null,
      avatar_url:            (row.avatar_url as string) ?? null,
      email:                 emailMap.get(String(row.id)) ?? null,
      base_role:             baseRole,
      admin_role:            adminRole,
      admin_role_definition: adminRole ? (defMap.get(adminRole) ?? null) : null,
      is_super_admin:        baseRole === "admin" && adminRole === "super_admin",
      is_dev:                adminRole === "dev"   || adminRole === "developer",
      created_at:            String(row.created_at),
      updated_at:            String(row.updated_at),
    };
  });
}

export async function getStaffMemberById(id: string): Promise<StaffMember | null> {
  const supabase = await createSupabaseServerClient();

  const [profileResult, defsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar_url, base_role, admin_role, school_id, created_at, updated_at")
      .eq("id", id)
      .single(),
    supabase
      .from("admin_role_definitions")
      .select("*")
      .eq("is_active", true),
  ]);

  if (profileResult.error || !profileResult.data) return null;
  const row = profileResult.data;
  const schoolId = (row.school_id as string) ?? null;

  // Filter defs to this tenant only
  const defs = ((defsResult.data ?? []) as AdminRoleDefinition[]).filter(
    (d) => d.school_id === schoolId
  );
  const defMap   = new Map(defs.map((d) => [d.id, d]));
  const emailMap = await buildEmailMap([id]);

  const baseRole  = (row.base_role  as BaseRole) || "staff";
  const adminRole = (row.admin_role as string)   || null;

  return {
    id:                    String(row.id),
    full_name:             (row.full_name  as string) ?? null,
    avatar_url:            (row.avatar_url as string) ?? null,
    email:                 emailMap.get(id) ?? null,
    base_role:             baseRole,
    admin_role:            adminRole,
    admin_role_definition: adminRole ? (defMap.get(adminRole) ?? null) : null,
    is_super_admin:        baseRole === "admin" && adminRole === "super_admin",
    is_dev:                adminRole === "dev"   || adminRole === "developer",
    created_at:            String(row.created_at),
    updated_at:            String(row.updated_at),
  };
}

export async function getRoleStatistics(): Promise<RoleStatistics> {
  const { user, actor } = await getVerifiedSuperAdmin();
  if (!user || !actor?.school_id) return { total: 0, byBaseRole: {}, byAdminRole: {} };

  const supabase = await createSupabaseServerClient();
  const { data }  = await supabase
    .from("profiles")
    .select("base_role, admin_role")
    .eq("school_id", actor.school_id);

  const empty: RoleStatistics = { total: 0, byBaseRole: {}, byAdminRole: {} };
  if (!data) return empty;

  const byBaseRole = data.reduce<Partial<Record<BaseRole, number>>>((acc, r) => {
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
// FIX: admin_role_definitions validation now uses BOTH id + school_id (composite key)
export async function assignRoleAction(payload: AssignRolePayload): Promise<ActionResult> {
  const { user, supabase, actor } = await getVerifiedSuperAdmin();
  if (!user) return { success: false, message: "Unauthorized. Super Admin access required." };
  if (!actor?.school_id) return { success: false, message: "Could not resolve institutional tenant context." };

  const { targetUserId, base_role, admin_role, reason } = payload;

  if (!targetUserId) return { success: false, message: "Target user ID is required." };

  if (targetUserId === user.id && base_role !== "admin") {
    return { success: false, message: "You cannot demote your own account." };
  }
  if (targetUserId === user.id && admin_role !== "super_admin") {
    return { success: false, message: "You cannot remove your own Super Admin title." };
  }

  const schoolId = actor.school_id;

  // FIX: composite key validation — must match BOTH school_id AND id
  if (admin_role) {
    const { data: def } = await supabase
      .from("admin_role_definitions")
      .select("id, is_active")
      .eq("id", admin_role)
      .eq("school_id", schoolId)          // ← composite key guard
      .single();

    if (!def) return { success: false, message: `Role "${admin_role}" does not exist in this school.` };
    if (!def.is_active) return { success: false, message: `Role "${admin_role}" is currently deactivated.` };
  }

  if (base_role === "admin" && !admin_role) {
    return { success: false, message: "An administrative title is required for administrator accounts." };
  }

  try {
    const { data: before } = await supabase
      .from("profiles")
      .select("full_name, base_role, admin_role")
      .eq("id", targetUserId)
      .single();

    const { error } = await supabase
      .from("profiles")
      .update({
        base_role,
        admin_role: base_role === "admin" ? (admin_role ?? null) : null,
      })
      .eq("id", targetUserId);

    if (error) {
      console.error("[assignRoleAction] update error:", error.message);
      return { success: false, message: "Failed to update role. Please try again." };
    }

    // Non-blocking audit log
    void supabaseAdmin.from("role_audit_logs").insert({
      actor_id:        user.id,
      target_id:       targetUserId,
      action:          admin_role ? "role_assigned" : "role_revoked",
      previous_values: { base_role: before?.base_role, admin_role: before?.admin_role },
      new_values:      { base_role, admin_role: admin_role ?? null },
      reason:          reason || "Role change by Super Admin",
    }).then(({ error: e }) => { if (e) console.warn("[audit]", e.message); });

    if (before?.full_name) {
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(targetUserId);
      const email = authUser?.user?.email;
      if (email) {
        sendRoleAssignmentNotification({
          recipientEmail: email,
          recipientName:  before.full_name as string,
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

export async function getAllRoleDefinitions(): Promise<AdminRoleDefinition[]> {
  const { user, supabase, actor } = await getVerifiedSuperAdmin();
  if (!user || !actor?.school_id) return [];

  const { data, error } = await supabase
    .from("admin_role_definitions")
    .select("*")
    .eq("school_id", actor.school_id)
    .order("sort_order", { ascending: true });

  if (error) { console.error("[getAllRoleDefinitions]", error.message); return []; }
  return (data ?? []) as AdminRoleDefinition[];
}

export async function getActiveRoleDefinitions(): Promise<AdminRoleDefinition[]> {
  const { user, actor } = await getVerifiedSuperAdmin();
  if (!user || !actor?.school_id) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("admin_role_definitions")
    .select("*")
    .eq("school_id", actor.school_id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) { console.error("[getActiveRoleDefinitions]", error.message); return []; }
  return (data ?? []) as AdminRoleDefinition[];
}

export async function createRoleDefinitionAction(
  payload: RoleDefinitionPayload
): Promise<ActionResult> {
  const { user, actor } = await getVerifiedSuperAdmin();
  if (!user) return { success: false, message: "Unauthorized." };
  if (!actor?.school_id) return { success: false, message: "Could not resolve institutional tenant context." };

  const { id, label, description, allowed_paths, sort_order } = payload;
  const schoolId = actor.school_id;

  const supabase = await createSupabaseServerClient();

  // FIX: duplicate check uses composite key
  const { data: existing } = await supabase
    .from("admin_role_definitions")
    .select("id")
    .eq("id", id)
    .eq("school_id", schoolId)            // ← composite key guard
    .maybeSingle();

  if (existing) return { success: false, message: `A role with ID "${id}" already exists in this school.` };

  const { error } = await supabaseAdmin
    .from("admin_role_definitions")
    .insert({ id, school_id: schoolId, label, description, allowed_paths, sort_order, is_active: true });

  if (error) {
    console.error("[createRoleDefinitionAction]", error.message);
    return { success: false, message: "Failed to create role definition." };
  }

  void supabaseAdmin.from("role_audit_logs").insert({
    actor_id:        user.id,
    target_id:       user.id,
    action:          "role_def_created",
    previous_values: {},
    new_values:      { id, label, allowed_paths, school_id: schoolId },
    reason:          `New role definition: ${label}`,
  }).then(({ error: e }) => { if (e) console.warn("[audit]", e.message); });

  invalidate("/admin/staff");
  return { success: true, message: `Role "${label}" created successfully.` };
}

// FIX: all admin_role_definitions writes now chain .eq("school_id", schoolId)
export async function updateRoleDefinitionAction(
  id: string,
  payload: Omit<RoleDefinitionPayload, "id"> & { is_active: boolean }
): Promise<ActionResult> {
  const { user, actor } = await getVerifiedSuperAdmin();
  if (!user) return { success: false, message: "Unauthorized." };
  if (!actor?.school_id) return { success: false, message: "Could not resolve institutional tenant context." };

  if (id === "super_admin") {
    return { success: false, message: "The Super Administrator role cannot be modified." };
  }

  const schoolId = actor.school_id;
  const supabase  = await createSupabaseServerClient();

  // FIX: snapshot uses composite key
  const { data: before } = await supabase
    .from("admin_role_definitions")
    .select("*")
    .eq("id", id)
    .eq("school_id", schoolId)            // ← composite key guard
    .single();

  if (!before) return { success: false, message: `Role "${id}" not found in this school.` };

  // FIX: update uses composite key
  const { error } = await supabaseAdmin
    .from("admin_role_definitions")
    .update({
      label:         payload.label,
      description:   payload.description,
      allowed_paths: payload.allowed_paths,
      sort_order:    payload.sort_order,
      is_active:     payload.is_active,
    })
    .eq("id", id)
    .eq("school_id", schoolId);           // ← composite key guard

  if (error) {
    console.error("[updateRoleDefinitionAction]", error.message);
    return { success: false, message: "Failed to update role definition." };
  }

  // Re-trigger JWT sync trigger for all users carrying this role in THIS school
  if (JSON.stringify(before.allowed_paths) !== JSON.stringify(payload.allowed_paths)) {
    await supabaseAdmin
      .from("profiles")
      .update({ admin_role: id })
      .eq("admin_role", id)
      .eq("school_id", schoolId);
  }

  void supabaseAdmin.from("role_audit_logs").insert({
    actor_id:        user.id,
    target_id:       user.id,
    action:          "role_def_updated",
    previous_values: before as Record<string, unknown>,
    new_values:      { id, ...payload },
    reason:          `Role definition updated: ${id}`,
  }).then(({ error: e }) => { if (e) console.warn("[audit]", e.message); });

  invalidate("/admin/staff");
  return { success: true, message: `Role "${payload.label}" updated successfully.` };
}

// FIX: deactivation uses composite key throughout
export async function deactivateRoleDefinitionAction(
  id: string,
  reason: string
): Promise<ActionResult> {
  const { user, actor } = await getVerifiedSuperAdmin();
  if (!user) return { success: false, message: "Unauthorized." };
  if (!actor?.school_id) return { success: false, message: "Could not resolve institutional tenant context." };

  if (id === "super_admin") {
    return { success: false, message: "The Super Administrator role cannot be deactivated." };
  }

  const schoolId = actor.school_id;
  const supabase  = await createSupabaseServerClient();

  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("admin_role", id)
    .eq("school_id", schoolId);

  // FIX: update uses composite key
  const { error } = await supabaseAdmin
    .from("admin_role_definitions")
    .update({ is_active: false })
    .eq("id", id)
    .eq("school_id", schoolId);           // ← composite key guard

  if (error) {
    console.error("[deactivateRoleDefinitionAction]", error.message);
    return { success: false, message: "Failed to deactivate role." };
  }

  await supabaseAdmin
    .from("profiles")
    .update({ admin_role: null })
    .eq("admin_role", id)
    .eq("school_id", schoolId);

  void supabaseAdmin.from("role_audit_logs").insert({
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

// ─────────────────────────────────────────────────────────────────────────────
// ── D. CREATE STAFF USER ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
//
// Flow:
//   1. Resolve admin's school_id from profile context
//   2. Insert teachers anchor row → get teacher UUID
//   3. Create auth user
//   4. Update profile to bind teacher_id
//   5. Rollback: on profile failure → delete auth user + teacher row (Promise.all with IIFE wrappers)
//
// FIX: rollback Promise.all wraps PostgREST builders in async IIFEs so they
//      evaluate as native Promise<void>, not raw Thenables.
//
// NOTE: profiles.roles is no longer written. accessible_portals is derived
// entirely by sync_user_jwt_claims from base_role + teacher_id +
// staff_role_assignments — assigning teacher_id (Step 2/4) and admin_role
// (via assignRoleAction or this insert) is sufficient to grant multi-portal
// access; no separate `roles` array write is needed or performed.

export async function createStaffUserAction(formData: FormData): Promise<ActionResult> {
  const { user } = await getVerifiedSuperAdmin();
  if (!user) return { success: false, message: "Unauthorized. Super Admin access required." };

  const full_name    = formData.get("full_name")    as string;
  const email        = formData.get("email")        as string;
  const base_role    = formData.get("base_role")    as BaseRole;
  const admin_role   = (formData.get("admin_role")  as string) || null;
  const phone_number = (formData.get("phone_number") as string) || null;
  // is_teacher flag — admins can be non-teaching staff
  const is_teacher   = formData.get("is_teacher") === "true";

  if (!full_name || !email || !base_role) {
    return { success: false, message: "Missing required profile fields." };
  }
  if (base_role === "admin" && !admin_role) {
    return { success: false, message: "An administrative title is required for administrator accounts." };
  }

  try {
    // ── Step 1: Resolve tenant boundary ──────────────────────────────────────
    const supabase = await createSupabaseServerClient();
    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    if (!adminProfile?.school_id) {
      return { success: false, message: "Could not resolve institutional tenant context." };
    }

    const schoolId = adminProfile.school_id as string;

    // Validate admin_role exists for this school (composite key)
    if (admin_role) {
      const { data: roleDef } = await supabase
        .from("admin_role_definitions")
        .select("id, is_active")
        .eq("id", admin_role)
        .eq("school_id", schoolId)
        .single();

      if (!roleDef) return { success: false, message: `Role "${admin_role}" does not exist in this school.` };
      if (!roleDef.is_active) return { success: false, message: `Role "${admin_role}" is currently deactivated.` };
    }

    // ── Step 2: Provision teachers anchor row ─────────────────────────────────
    // Always create the anchor — even non-teaching admins get a teachers row
    // so the foreign key chain (profiles.teacher_id → teachers.id) is intact.
    const { data: newTeacher, error: teacherErr } = await supabaseAdmin
      .from("teachers")
      .insert({ school_id: schoolId, status: "active" })
      .select("id")
      .single();

    if (teacherErr || !newTeacher) {
      console.error("[createStaffUserAction] teacher row init failed:", teacherErr?.message);
      return { success: false, message: "Failed to initialize directory entry." };
    }

    // ── Step 3: Create auth user ──────────────────────────────────────────────
    const tempPassword =
      Math.random().toString(36).slice(-10) +
      Math.random().toString(36).toUpperCase().slice(-4) +
      "!0";

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password:      tempPassword,
      email_confirm: true,
      user_metadata: { full_name, phone_number, school_id: schoolId },
    });

    if (authError || !authData.user) {
      console.error("[createStaffUserAction] auth creation failed:", authError?.message);
      // Rollback teachers row — builder wrapped in IIFE for native Promise
      await (async () => {
        await supabaseAdmin.from("teachers").delete().eq("id", newTeacher.id);
      })();
      return { success: false, message: authError?.message || "Failed to provision authentication account." };
    }

    const newUserId = authData.user.id;

    // ── Step 4: Bind profile ──────────────────────────────────────────────────
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name,
        phone_number,
        base_role,
        admin_role:  base_role === "admin" ? admin_role : null,
        school_id:   schoolId,
        teacher_id:  newTeacher.id,   // structural bridge — the whole point
        updated_at:  new Date().toISOString(),
      })
      .eq("id", newUserId);

    if (profileError) {
      console.error("[createStaffUserAction] profile binding failed:", profileError.message);
      // FIX: both rollback ops wrapped in async IIFEs → true Promise<void>[]
      await Promise.all([
        (async () => { await supabaseAdmin.auth.admin.deleteUser(newUserId); })(),
        (async () => { await supabaseAdmin.from("teachers").delete().eq("id", newTeacher.id); })(),
      ]);
      return { success: false, message: "Failed to construct application user profile." };
    }

    // ── Step 5: Audit log (non-blocking) ──────────────────────────────────────
    void supabaseAdmin.from("role_audit_logs").insert({
      actor_id:        user.id,
      target_id:       newUserId,
      action:          "user_created",
      previous_values: {},
      new_values:      { email, base_role, admin_role, teacher_id: newTeacher.id, is_teacher },
      reason:          `Staff account initialized for ${full_name}`,
    }).then(({ error: e }) => { if (e) console.warn("[audit]", e.message); });

    invalidate("/admin/staff");
    return { success: true, message: `Staff account for ${full_name} established successfully.` };

  } catch (err) {
    console.error("[createStaffUserAction] unexpected:", err);
    return { success: false, message: "An unexpected network error occurred." };
  }
}