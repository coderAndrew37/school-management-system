"use server";

// lib/actions/rbac-actions.ts
// Kibali Academy — RBAC Server Actions
//
// Every mutating action performs a REAL-TIME database super-admin check.
// JWT claims are re-synced after every permission-affecting mutation so
// the next request reflects the change immediately.
//
// Audit log entries are written with structured JSONB context payloads
// so the audit trail UI can render rich diffs without re-fetching related rows.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath }             from "next/cache";

// ── Shared result type ────────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  error?:  string;
}

// ── Internal: resolve and guard super-admin context ──────────────────────────

interface AdminContext {
  userId:   string;
  schoolId: string;
}

async function requireSuperAdmin(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<AdminContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("school_id, is_super_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_super_admin || !profile?.school_id) {
    throw new Error("Unauthorized: Super Admin access required.");
  }

  return { userId: user.id, schoolId: profile.school_id as string };
}

// ── Internal: flush JWT claims after any permission-affecting mutation ────────

async function syncJwtClaims(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string
): Promise<void> {
  await supabase.rpc("sync_user_jwt_claims", { p_profile_id: profileId });
}

// ── Internal: append audit log entry ─────────────────────────────────────────

interface AuditPayload {
  schoolId:    string;
  actorId:     string;
  targetId?:   string;
  actionType:  string;
  targetTable: string;
  recordId:    string;
  oldValues?:  Record<string, unknown> | null;
  newValues?:  Record<string, unknown> | null;
  context?:    Record<string, unknown>;
}

async function writeAuditLog(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  payload: AuditPayload
): Promise<void> {
  await supabase.from("security_audit_logs").insert({
    school_id:    payload.schoolId,
    actor_id:     payload.actorId,
    target_id:    payload.targetId   ?? null,
    action_type:  payload.actionType,
    target_table: payload.targetTable,
    record_id:    payload.recordId,
    old_values:   payload.oldValues  ? JSON.stringify(payload.oldValues)  : null,
    new_values:   payload.newValues  ? JSON.stringify(payload.newValues)  : null,
    context:      payload.context    ?? {},
  });
}

// ============================================================================
// ACTION 1: ASSIGN ROLE
// ============================================================================

export interface AssignRolePayload {
  profileId:  string;
  roleId:     string;
  notes?:     string;
}

/**
 * Creates an active staff_role_assignments row linking a profile to a role.
 * Re-syncs JWT claims immediately. Logs the assignment to the audit trail.
 */
export async function assignRoleAction(
  payload: AssignRolePayload
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const { userId, schoolId } = await requireSuperAdmin(supabase);

    // Snapshot previous active roles for the diff
    const { data: previousRoles } = await supabase
      .from("staff_role_assignments")
      .select("role_id")
      .eq("profile_id", payload.profileId)
      .is("revoked_at", null);

    const { error } = await supabase
      .from("staff_role_assignments")
      .insert({
        school_id:   schoolId,
        profile_id:  payload.profileId,
        role_id:     payload.roleId,
        assigned_by: userId,
        notes:       payload.notes ?? null,
      });

    if (error) throw error;

    await syncJwtClaims(supabase, payload.profileId);

    await writeAuditLog(supabase, {
      schoolId,
      actorId:     userId,
      targetId:    payload.profileId,
      actionType:  "ROLE_ASSIGN",
      targetTable: "staff_role_assignments",
      recordId:    payload.profileId,
      oldValues:   { roles: previousRoles?.map((r) => r.role_id) ?? [] },
      newValues:   { role_assigned: payload.roleId },
      context:     { role_id: payload.roleId, notes: payload.notes ?? null },
    });

    revalidatePath("/admin/security");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to assign role.";
    return { success: false, error: msg };
  }
}

// ============================================================================
// ACTION 2: REVOKE ROLE
// ============================================================================

export interface RevokeRolePayload {
  assignmentId:  string;
  profileId:     string;
  revokeReason?: string;
}

/**
 * Sets revoked_at on a staff_role_assignments row (soft delete — keeps history).
 * Re-syncs JWT claims so revocation is effective on next request.
 */
export async function revokeRoleAction(
  payload: RevokeRolePayload
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const { userId, schoolId } = await requireSuperAdmin(supabase);

    // Snapshot old row
    const { data: oldRow } = await supabase
      .from("staff_role_assignments")
      .select("role_id, assigned_at, assigned_by")
      .eq("id", payload.assignmentId)
      .single();

    const { error } = await supabase
      .from("staff_role_assignments")
      .update({
        revoked_at:    new Date().toISOString(),
        revoke_reason: payload.revokeReason ?? null,
      })
      .eq("id",        payload.assignmentId)
      .eq("school_id", schoolId)
      .is("revoked_at", null);

    if (error) throw error;

    await syncJwtClaims(supabase, payload.profileId);

    await writeAuditLog(supabase, {
      schoolId,
      actorId:     userId,
      targetId:    payload.profileId,
      actionType:  "ROLE_REVOKE",
      targetTable: "staff_role_assignments",
      recordId:    payload.assignmentId,
      oldValues:   oldRow ?? null,
      newValues:   { revoked_at: new Date().toISOString(), revoke_reason: payload.revokeReason ?? null },
      context:     { role_id: oldRow?.role_id ?? null, reason: payload.revokeReason ?? null },
    });

    revalidatePath("/admin/security");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to revoke role.";
    return { success: false, error: msg };
  }
}

// ============================================================================
// ACTION 3: UPDATE PERMISSION OVERRIDES
// ============================================================================

export interface UpdateOverridesPayload {
  profileId:                   string;
  allowed_permissions_override: string[];
  denied_permissions_override:  string[];
}

/**
 * Replaces the override arrays on a profile row.
 * The profiles UPDATE trigger automatically calls sync_user_jwt_claims,
 * so JWT is re-synced even without the explicit RPC call here.
 * We call syncJwtClaims explicitly as a belt-and-suspenders guarantee.
 */
export async function updatePermissionOverridesAction(
  payload: UpdateOverridesPayload
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const { userId, schoolId } = await requireSuperAdmin(supabase);

    // Snapshot current state
    const { data: currentProfile } = await supabase
      .from("profiles")
      .select("allowed_permissions_override, denied_permissions_override, full_name")
      .eq("id", payload.profileId)
      .single();

    const { error } = await supabase
      .from("profiles")
      .update({
        allowed_permissions_override: payload.allowed_permissions_override,
        denied_permissions_override:  payload.denied_permissions_override,
      })
      .eq("id",       payload.profileId)
      .eq("school_id", schoolId);

    if (error) throw error;

    // Explicit sync (trigger will also fire, but this ensures immediate consistency)
    await syncJwtClaims(supabase, payload.profileId);

    await writeAuditLog(supabase, {
      schoolId,
      actorId:     userId,
      targetId:    payload.profileId,
      actionType:  "PERMISSION_OVERRIDE_SET",
      targetTable: "profiles",
      recordId:    payload.profileId,
      oldValues: {
        allowed_permissions_override: currentProfile?.allowed_permissions_override ?? [],
        denied_permissions_override:  currentProfile?.denied_permissions_override  ?? [],
      },
      newValues: {
        allowed_permissions_override: payload.allowed_permissions_override,
        denied_permissions_override:  payload.denied_permissions_override,
      },
      context: {
        target_name:    currentProfile?.full_name ?? payload.profileId,
        granted_count:  payload.allowed_permissions_override.length,
        revoked_count:  payload.denied_permissions_override.length,
      },
    });

    revalidatePath("/admin/security");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update permission overrides.";
    return { success: false, error: msg };
  }
}

// ============================================================================
// ACTION 4: SAVE / UPDATE ROLE DEFINITION
// ============================================================================

export interface SaveRoleDefinitionPayload {
  id:                  string;   // slug: 'bursar', 'class_teacher_east'
  label:               string;
  description:         string;
  baseline_permissions: string[];
  allowed_paths:       string[];
  sort_order?:         number;
}

/**
 * Upserts an admin_role_definitions row.
 * After saving, re-syncs JWT for all staff currently holding this role
 * so the updated baseline_permissions propagate immediately.
 */
export async function saveRoleDefinitionAction(
  payload: SaveRoleDefinitionPayload
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const { userId, schoolId } = await requireSuperAdmin(supabase);

    // Snapshot old definition for diff
    const { data: oldDef } = await supabase
      .from("admin_role_definitions")
      .select("*")
      .eq("id",        payload.id)
      .eq("school_id", schoolId)
      .maybeSingle();

    const { error } = await supabase
      .from("admin_role_definitions")
      .upsert(
        {
          id:                  payload.id,
          school_id:           schoolId,
          label:               payload.label,
          description:         payload.description,
          baseline_permissions: payload.baseline_permissions,
          allowed_paths:       payload.allowed_paths,
          sort_order:          payload.sort_order ?? 0,
        },
        { onConflict: "school_id,id" }
      );

    if (error) throw error;

    // Re-sync all staff currently holding this role
    const { data: assignments } = await supabase
      .from("staff_role_assignments")
      .select("profile_id")
      .eq("role_id",   payload.id)
      .eq("school_id", schoolId)
      .is("revoked_at", null);

    for (const a of assignments ?? []) {
      await syncJwtClaims(supabase, a.profile_id as string);
    }

    await writeAuditLog(supabase, {
      schoolId,
      actorId:     userId,
      actionType:  oldDef ? "UPDATE" : "INSERT",
      targetTable: "admin_role_definitions",
      recordId:    payload.id,
      oldValues:   oldDef   ?? null,
      newValues:   payload,
      context:     {
        role_id:           payload.id,
        label:             payload.label,
        permissions_count: payload.baseline_permissions.length,
        affected_staff:    (assignments ?? []).length,
      },
    });

    revalidatePath("/admin/security");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save role definition.";
    return { success: false, error: msg };
  }
}

// ============================================================================
// ACTION 5: TRANSFER OUT
// ============================================================================

export interface TransferOutPayload {
  teacherId:               string;
  destinationSchoolName:   string;
  reason?:                 string;
}

/**
 * Offboards a departing teacher atomically:
 *   - Marks teacher as transferred
 *   - Revokes all active role assignments
 *   - Clears permission overrides
 *   - Wipes JWT permissions to [] immediately
 * Uses the execute_teacher_transfer_out DB function for atomicity.
 */
export async function transferTeacherOutAction(
  payload: TransferOutPayload
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const { userId, schoolId } = await requireSuperAdmin(supabase);

    // Snapshot pre-transfer state for the audit diff
    const { data: oldProfile } = await supabase
      .from("profiles")
      .select("full_name, allowed_permissions_override, denied_permissions_override")
      .eq("id", payload.teacherId)
      .single();

    const { data: oldRoles } = await supabase
      .from("staff_role_assignments")
      .select("role_id")
      .eq("profile_id", payload.teacherId)
      .is("revoked_at", null);

    const { error } = await supabase.rpc("execute_teacher_transfer_out", {
      p_teacher_id:          payload.teacherId,
      p_destination_school:  payload.destinationSchoolName,
    });

    if (error) throw error;

    await writeAuditLog(supabase, {
      schoolId,
      actorId:     userId,
      targetId:    payload.teacherId,
      actionType:  "TRANSFER_OUT",
      targetTable: "teachers",
      recordId:    payload.teacherId,
      oldValues: {
        roles:                       (oldRoles ?? []).map((r) => r.role_id),
        allowed_permissions_override: oldProfile?.allowed_permissions_override ?? [],
        denied_permissions_override:  oldProfile?.denied_permissions_override  ?? [],
      },
      newValues: {
        status:                      "transferred",
        destination_school:          payload.destinationSchoolName,
        roles:                       [],
        allowed_permissions_override: [],
        denied_permissions_override:  [],
      },
      context: {
        target_name:        oldProfile?.full_name   ?? payload.teacherId,
        destination_school: payload.destinationSchoolName,
        reason:             payload.reason          ?? null,
        roles_revoked:      (oldRoles ?? []).length,
      },
    });

    revalidatePath("/admin/security");
    revalidatePath("/admin/teachers");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process transfer out.";
    return { success: false, error: msg };
  }
}

// ============================================================================
// ACTION 6: TRANSFER IN
// ============================================================================

export interface TransferInPayload {
  fullName:        string;
  tscNumber:       string;
  email:           string;
  phoneNumber:     string;
  initialRoleIds:  string[];
  notes?:          string;
}

/**
 * Ingests an incoming teacher:
 *   - Matches on TSC number to detect historical profile (re-activate vs create)
 *   - Sets status = active, clears transfer fields
 *   - Assigns initial roles
 *   - Syncs JWT claims
 */
export async function transferTeacherInAction(
  payload: TransferInPayload
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const { userId, schoolId } = await requireSuperAdmin(supabase);

    // Detect existing profile by TSC number
    const { data: existingTeacher } = await supabase
      .from("teachers")
      .select("id, full_name")
      .eq("tsc_number", payload.tscNumber)
      .maybeSingle();

    let targetId: string;
    const ingestMode: string = existingTeacher
      ? "re_activated_historical_profile"
      : "fresh_profile_creation";

    if (existingTeacher) {
      // Re-activate
      await supabase
        .from("profiles")
        .update({
          full_name:    payload.fullName,
          email:        payload.email,
          phone_number: payload.phoneNumber,
          role:         "admin",
        })
        .eq("id", existingTeacher.id as string);

      await supabase
        .from("teachers")
        .update({
          status:                      "active",
          transfer_destination_school: null,
          transfer_date:               null,
          archived_at:                 null,
        })
        .eq("id", existingTeacher.id as string);

      targetId = existingTeacher.id as string;
    } else {
      // Create new Supabase auth user + profile + teacher row
      const newUid = crypto.randomUUID();

      await supabase
        .from("profiles")
        .insert({
          id:           newUid,
          school_id:    schoolId,
          full_name:    payload.fullName,
          email:        payload.email,
          phone_number: payload.phoneNumber,
          role:         "admin",
          is_super_admin: false,
          is_dev:         false,
        });

      await supabase
        .from("teachers")
        .insert({
          id:        newUid,
          school_id: schoolId,
          tsc_number: payload.tscNumber,
          status:    "active",
        });

      targetId = newUid;
    }

    // Assign initial roles
    if (payload.initialRoleIds.length > 0) {
      const roleRows = payload.initialRoleIds.map((roleId) => ({
        school_id:   schoolId,
        profile_id:  targetId,
        role_id:     roleId,
        assigned_by: userId,
        notes:       payload.notes ?? null,
      }));
      const { error: roleError } = await supabase
        .from("staff_role_assignments")
        .insert(roleRows);
      if (roleError) throw roleError;
    }

    await syncJwtClaims(supabase, targetId);

    await writeAuditLog(supabase, {
      schoolId,
      actorId:     userId,
      targetId:    targetId,
      actionType:  "TRANSFER_IN",
      targetTable: "teachers",
      recordId:    targetId,
      oldValues:   existingTeacher ? { previous_name: existingTeacher.full_name } : null,
      newValues: {
        status:          "active",
        tsc_number:      payload.tscNumber,
        roles_assigned:  payload.initialRoleIds,
      },
      context: {
        target_name:    payload.fullName,
        tsc_number:     payload.tscNumber,
        ingest_mode:    ingestMode,
        roles_assigned: payload.initialRoleIds.length,
      },
    });

    revalidatePath("/admin/security");
    revalidatePath("/admin/teachers");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to process transfer in.";
    return { success: false, error: msg };
  }
}