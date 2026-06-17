"use server";

// lib/actions/rbac-actions.ts
// Kibali Academy — RBAC Server Actions
//
// Distinct from role-management.ts:
//   - This file handles STAFF-LEVEL operations: assignment of roles to
//     individual staff members, permission overrides, and transfers.
//     Consumer: StaffAccessMatrix.tsx, RoleConfigurator.tsx
//
//   - role-management.ts handles SUPER-ADMIN operations: role definition
//     CRUD, bulk staff creation, statistics. Consumer: admin staff pages.
//
// Key schema facts reflected here:
//   - admin_role is NOT a profiles column — it lives in staff_role_assignments
//     and is synced into JWT app_metadata.admin_role by sync_user_jwt_claims
//   - Permission overrides live on profiles.allowed/denied_permissions_override
//   - All mutations call sync_user_jwt_claims RPC after change
//   - Audit logs write to security_audit_logs (structured JSONB context)

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath }             from 'next/cache';

// ── Shared result type ─────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  error?:  string;
  message?: string;
}

// ── Admin context guard ────────────────────────────────────────────────────

interface AdminContext {
  userId:   string;
  schoolId: string;
}

async function requireSuperAdmin(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<AdminContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('school_id, is_super_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_super_admin || !profile?.school_id) {
    throw new Error('Unauthorized: Super Admin access required.');
  }

  return { userId: user.id, schoolId: profile.school_id as string };
}

// ── JWT sync helper ────────────────────────────────────────────────────────

async function syncJwt(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  profileId: string
): Promise<void> {
  await supabase.rpc('sync_user_jwt_claims', { p_profile_id: profileId });
}

// ── Audit log helper ───────────────────────────────────────────────────────

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

async function writeAudit(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  p: AuditPayload
): Promise<void> {
  await supabase.from('security_audit_logs').insert({
    school_id:    p.schoolId,
    actor_id:     p.actorId,
    target_id:    p.targetId   ?? null,
    action_type:  p.actionType,
    target_table: p.targetTable,
    record_id:    p.recordId,
    old_values:   p.oldValues  ? JSON.stringify(p.oldValues)  : null,
    new_values:   p.newValues  ? JSON.stringify(p.newValues)  : null,
    context:      p.context    ?? {},
  });
}

// ── Helper: resolve profile_id from teacher_id ────────────────────────────

async function resolveProfileId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  teacherId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('teacher_id', teacherId)
    .maybeSingle();
  return (data?.id as string) ?? null;
}

// ============================================================================
// ACTION 1: SAVE / UPSERT ROLE DEFINITION
// ============================================================================

export interface SaveRoleDefinitionPayload {
  id:                   string;
  label:                string;
  description:          string;
  baseline_permissions: string[];
  allowed_paths:        string[];
  sort_order?:          number;
}

export async function saveRoleDefinitionAction(
  payload: SaveRoleDefinitionPayload
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const { userId, schoolId } = await requireSuperAdmin(supabase);

    const { data: oldDef } = await supabase
      .from('admin_role_definitions')
      .select('*')
      .eq('id', payload.id)
      .eq('school_id', schoolId)
      .maybeSingle();

    const { error } = await supabase
      .from('admin_role_definitions')
      .upsert(
        {
          id:                   payload.id,
          school_id:            schoolId,
          label:                payload.label,
          description:          payload.description,
          baseline_permissions: payload.baseline_permissions,
          allowed_paths:        payload.allowed_paths,
          sort_order:           payload.sort_order ?? 0,
        },
        { onConflict: 'school_id,id' }
      );

    if (error) throw error;

    // Re-sync JWT for all staff currently holding this role
    const { data: assignments } = await supabase
      .from('staff_role_assignments')
      .select('profile_id')
      .eq('role_id', payload.id)
      .eq('school_id', schoolId)
      .is('revoked_at', null);

    for (const a of assignments ?? []) {
      await syncJwt(supabase, a.profile_id as string);
    }

    await writeAudit(supabase, {
      schoolId,
      actorId:     userId,
      actionType:  oldDef ? 'UPDATE' : 'INSERT',
      targetTable: 'admin_role_definitions',
      recordId:    payload.id,
      oldValues:   oldDef   ?? null,
      newValues:   payload as unknown as Record<string, unknown>,
      context: {
        role_id:           payload.id,
        label:             payload.label,
        permissions_count: payload.baseline_permissions.length,
        affected_staff:    (assignments ?? []).length,
      },
    });

    revalidatePath('/admin/security');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to save role.' };
  }
}

// ============================================================================
// ACTION 2: DELETE ROLE DEFINITION
// ============================================================================

export async function deleteRoleDefinitionAction(roleId: string): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const { userId, schoolId } = await requireSuperAdmin(supabase);

    const { data: oldDef } = await supabase
      .from('admin_role_definitions')
      .select('label')
      .eq('id', roleId)
      .eq('school_id', schoolId)
      .maybeSingle();

    // Revoke all active assignments first so JWT syncs fire
    await supabase
      .from('staff_role_assignments')
      .update({ revoked_at: new Date().toISOString(), revoke_reason: 'Role definition deleted' })
      .eq('role_id', roleId)
      .eq('school_id', schoolId)
      .is('revoked_at', null);

    const { error } = await supabase
      .from('admin_role_definitions')
      .delete()
      .eq('id', roleId)
      .eq('school_id', schoolId);

    if (error) throw error;

    await writeAudit(supabase, {
      schoolId,
      actorId:     userId,
      actionType:  'DELETE',
      targetTable: 'admin_role_definitions',
      recordId:    roleId,
      oldValues:   oldDef as Record<string, unknown> ?? null,
      context:     { role_id: roleId, label: oldDef?.label ?? roleId },
    });

    revalidatePath('/admin/security');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to delete role.' };
  }
}

// ============================================================================
// ACTION 3: UPDATE STAFF ACCESS
// Assigns active role assignments and writes permission overrides to
// profiles.allowed_permissions_override / denied_permissions_override.
// ============================================================================

export interface UpdateStaffAccessPayload {
  roleIds:   string[];
  overrides: { permissionId: string; hasAccess: boolean }[];
}

export async function updateStaffAccessAction(
  teacherId: string,
  payload: UpdateStaffAccessPayload
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const { userId, schoolId } = await requireSuperAdmin(supabase);

    const profileId = await resolveProfileId(supabase, teacherId);
    if (!profileId) {
      throw new Error(`No profile found for teacher ${teacherId}. Ensure profiles.teacher_id is set.`);
    }

    const { data: prevAssignments } = await supabase
      .from('staff_role_assignments')
      .select('role_id, id')
      .eq('profile_id', profileId)
      .is('revoked_at', null);

    const { data: prevProfile } = await supabase
      .from('profiles')
      .select('allowed_permissions_override, denied_permissions_override')
      .eq('id', profileId)
      .single();

    // 1. Revoke roles no longer in the list
    const existingRoleIds = (prevAssignments ?? []).map((a) => a.role_id as string);
    const toRevoke = existingRoleIds.filter((r) => !payload.roleIds.includes(r));

    if (toRevoke.length > 0) {
      await supabase
        .from('staff_role_assignments')
        .update({ revoked_at: new Date().toISOString(), revoke_reason: 'Removed by super admin' })
        .eq('profile_id', profileId)
        .in('role_id', toRevoke)
        .is('revoked_at', null);
    }

    // 2. Assign new roles not already active
    const toAssign = payload.roleIds.filter((r) => !existingRoleIds.includes(r));

    if (toAssign.length > 0) {
      const rows = toAssign.map((roleId) => ({
        school_id:   schoolId,
        profile_id:  profileId,
        role_id:     roleId,
        assigned_by: userId,
      }));
      const { error: assignErr } = await supabase
        .from('staff_role_assignments')
        .insert(rows);
      if (assignErr) throw assignErr;
    }

    // 3. Write permission overrides to profiles columns
    const allowed = payload.overrides
      .filter((o) => o.hasAccess)
      .map((o) => o.permissionId);

    const denied = payload.overrides
      .filter((o) => !o.hasAccess)
      .map((o) => o.permissionId);

    const { error: overrideErr } = await supabase
      .from('profiles')
      .update({
        allowed_permissions_override: allowed,
        denied_permissions_override:  denied,
      })
      .eq('id', profileId);

    if (overrideErr) throw overrideErr;

    // 4. Explicit JWT sync (trigger also fires but this ensures immediate effect)
    await syncJwt(supabase, profileId);

    // 5. Audit log
    await writeAudit(supabase, {
      schoolId,
      actorId:     userId,
      targetId:    profileId,
      actionType:  'ROLE_ASSIGN',
      targetTable: 'staff_role_assignments',
      recordId:    profileId,
      oldValues: {
        roles:   existingRoleIds,
        allowed: prevProfile?.allowed_permissions_override ?? [],
        denied:  prevProfile?.denied_permissions_override  ?? [],
      },
      newValues: {
        roles:   payload.roleIds,
        allowed,
        denied,
      },
      context: {
        teacher_id:      teacherId,
        roles_assigned:  toAssign.length,
        roles_revoked:   toRevoke.length,
        overrides_count: payload.overrides.length,
      },
    });

    revalidatePath('/admin/security');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update staff access.' };
  }
}

// ============================================================================
// ACTION 4: TRANSFER OUT
// ============================================================================

export interface TransferOutPayload {
  teacherId:             string;
  destinationSchoolName: string;
  reason?:               string;
}

export async function transferTeacherOutAction(
  payload: TransferOutPayload
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const { userId, schoolId } = await requireSuperAdmin(supabase);

    const { data: oldTeacher } = await supabase
      .from('teachers')
      .select('full_name, status')
      .eq('id', payload.teacherId)
      .single();

    const profileId = await resolveProfileId(supabase, payload.teacherId);

    const { data: prevRoles } = profileId ? await supabase
      .from('staff_role_assignments')
      .select('role_id')
      .eq('profile_id', profileId)
      .is('revoked_at', null) : { data: [] };

    // Atomic DB function: marks teacher transferred, revokes roles,
    // clears overrides, wipes JWT
    const { error } = await supabase.rpc('execute_teacher_transfer_out', {
      p_teacher_id:         payload.teacherId,
      p_destination_school: payload.destinationSchoolName,
    });

    if (error) throw error;

    await writeAudit(supabase, {
      schoolId,
      actorId:    userId,
      targetId:   profileId ?? undefined,
      actionType: 'TRANSFER_OUT',
      targetTable: 'teachers',
      recordId:   payload.teacherId,
      oldValues: {
        status:     oldTeacher?.status ?? 'active',
        roles_held: (prevRoles ?? []).map((r) => r.role_id),
      },
      newValues: {
        status:            'transferred',
        destination:       payload.destinationSchoolName,
        roles_revoked:     (prevRoles ?? []).length,
        overrides_cleared: true,
      },
      context: {
        teacher_name: oldTeacher?.full_name ?? payload.teacherId,
        destination:  payload.destinationSchoolName,
        reason:       payload.reason ?? null,
      },
    });

    revalidatePath('/admin/security');
    revalidatePath('/admin/teachers');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to process transfer out.' };
  }
}

// ============================================================================
// ACTION 5: TRANSFER IN
// ============================================================================

export interface TransferInPayload {
  fullName:       string;
  tscNumber:      string;
  email:          string;
  phoneNumber:    string;
  initialRoleIds: string[];
  notes?:         string;
}

export async function transferTeacherInAction(
  payload: TransferInPayload
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();

  try {
    const { userId, schoolId } = await requireSuperAdmin(supabase);

    const { data: existingTeacher } = await supabase
      .from('teachers')
      .select('id, full_name')
      .eq('tsc_number', payload.tscNumber)
      .maybeSingle();

    let targetTeacherId: string;
    let targetProfileId: string;
    const isReactivation = !!existingTeacher;

    if (existingTeacher) {
      // Re-activate existing teacher
      targetTeacherId = existingTeacher.id as string;

      await supabase.from('teachers').update({
        status:                      'active',
        transfer_destination_school: null,
        transfer_date:               null,
        archived_at:                 null,
      }).eq('id', targetTeacherId);

      const profileId = await resolveProfileId(supabase, targetTeacherId);
      if (!profileId) throw new Error('Reactivation failed: profile link missing.');

      await supabase.from('profiles').update({
        full_name:    payload.fullName,
        email:        payload.email,
        phone_number: payload.phoneNumber,
      }).eq('id', profileId);

      targetProfileId = profileId;
    } else {
      // Create new teacher + profile
      // NOTE: base_role is used — NOT the legacy `role` column
      const newUid = crypto.randomUUID();

      const { error: profileErr } = await supabase.from('profiles').insert({
        id:             newUid,
        school_id:      schoolId,
        full_name:      payload.fullName,
        email:          payload.email,
        phone_number:   payload.phoneNumber,
        base_role:      'staff',
        is_super_admin: false,
        is_dev:         false,
      });
      if (profileErr) throw profileErr;

      const { error: teacherErr } = await supabase.from('teachers').insert({
        id:         newUid,
        school_id:  schoolId,
        tsc_number: payload.tscNumber,
        status:     'active',
      });
      if (teacherErr) throw teacherErr;

      // Link profile → teacher so sync_user_jwt_claims can add 'staff' portal
      await supabase.from('profiles')
        .update({ teacher_id: newUid })
        .eq('id', newUid);

      targetTeacherId = newUid;
      targetProfileId = newUid;
    }

    // Assign initial roles via staff_role_assignments
    if (payload.initialRoleIds.length > 0) {
      const rows = payload.initialRoleIds.map((roleId) => ({
        school_id:   schoolId,
        profile_id:  targetProfileId,
        role_id:     roleId,
        assigned_by: userId,
        notes:       payload.notes ?? null,
      }));
      const { error: roleErr } = await supabase.from('staff_role_assignments').insert(rows);
      if (roleErr) throw roleErr;
    }

    // Sync JWT so new accessible_portals are immediately reflected
    await syncJwt(supabase, targetProfileId);

    await writeAudit(supabase, {
      schoolId,
      actorId:    userId,
      targetId:   targetProfileId,
      actionType: 'TRANSFER_IN',
      targetTable: 'teachers',
      recordId:   targetTeacherId,
      oldValues:  isReactivation ? { previous_status: 'transferred' } : null,
      newValues: {
        status:         'active',
        tsc_number:     payload.tscNumber,
        roles_assigned: payload.initialRoleIds,
      },
      context: {
        teacher_name:   payload.fullName,
        tsc_number:     payload.tscNumber,
        ingest_mode:    isReactivation ? 're_activated' : 'new_profile',
        roles_assigned: payload.initialRoleIds.length,
      },
    });

    revalidatePath('/admin/security');
    revalidatePath('/admin/teachers');
    return { success: true };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to process transfer in.' };
  }
}