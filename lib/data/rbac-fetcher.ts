// lib/data/rbac-fetchers.ts
// Kibali Academy — RBAC Data Fetcher Layer
//
// Architecture recap:
//   profiles.role = system clearance: 'admin' | 'staff' | 'parent'
//   admin_role_definitions  = named roles with baseline permission token arrays
//   staff_role_assignments  = links profiles to role definitions (soft-delete lifecycle)
//   profiles.allowed_permissions_override = explicit per-user token grants
//   profiles.denied_permissions_override  = explicit per-user token revocations (deny wins)
//   permission_catalog      = master list of all valid domain-action tokens
//   security_audit_logs     = tamper-proof audit trail
//
// Views (UI routes) are managed via ADMIN_LINKS + ROUTE_PERMISSION_MAP in middleware.
// No separate views table needed — route→token mapping lives in the frontend manifest.
//
// Two-query strategy for staff directory:
//   PostgREST cannot traverse teachers→profiles→staff_role_assignments in one hop.
//   Query 1: teachers + profiles (one FK hop via profiles.teacher_id)
//   Query 2: staff_role_assignments + admin_role_definitions for resolved profile IDs
//   Merge in TypeScript.

import { createSupabaseServerClient } from '@/lib/supabase/server';

// ============================================================================
// INTERNAL RAW SHAPES
// ============================================================================

interface RawRoleAssignment {
  profile_id: string;
  role_id:    string;
  revoked_at: string | null;
  admin_role_definitions: {
    id:    string;
    label: string;
  } | null;
}

interface RawProfileJoin {
  id:                           string;
  full_name:                    string;
  email:                        string | null;
  phone_number:                 string | null;
  allowed_permissions_override: string[];
  denied_permissions_override:  string[];
}

interface RawTeacherRow {
  id:                          string;
  school_id:                   string;
  staff_id:                    string | null;
  tsc_number:                  string | null;
  status:                      TeacherStatus;
  transfer_destination_school: string | null;
  transfer_date:               string | null;
  created_at:                  string;
  // Joined via profiles.teacher_id → teachers.id
  profiles:                    RawProfileJoin | null;
}

interface RawAuditRow {
  id:            string;
  action_type:   AuditActionType;
  target_table:  string;
  record_id:     string;
  old_values:    string | null;
  new_values:    string | null;
  context:       Record<string, unknown> | null;
  created_at:    string;
  actor_profile: { id: string; full_name: string } | null;
}

// ============================================================================
// EXPORTED TYPES
// ============================================================================

export type TeacherStatus =
  | 'active'
  | 'on_leave'
  | 'transferred'
  | 'terminated'
  | 'resigned'
  | 'deceased'
  | 'retired';

export interface RoleWithPermissions {
  id:          string;
  role_name:   string;
  description: string;
  created_at:  string;
  permissions: {
    permission_id:   string;
    permission_name: string;
    category:        string;
  }[];
}

export interface SystemPermission {
  id:              string;
  permission_name: string;
  category:        string;
  description:     string;
}

export interface StaffAccessProfile {
  id:                          string;   // teachers.id
  profile_id:                  string | null;
  staff_id:                    string | null;
  full_name:                   string;   // from profiles
  tsc_number:                  string | null;
  email:                       string | null;  // from profiles
  phone_number:                string | null;  // from profiles
  status:                      TeacherStatus;
  transfer_destination_school: string | null;
  transfer_date:               string | null;
  // Active role assignments only (revoked_at IS NULL)
  roles: {
    id:        string;
    role_name: string;
  }[];
  // Flattened from profiles.allowed/denied_permissions_override
  overrides: {
    permission_id:   string;
    permission_name: string;
    has_access:      boolean;   // true = allowed, false = denied
  }[];
}

export type AuditActionType =
  | 'ROLE_ASSIGN'
  | 'ROLE_REVOKE'
  | 'PERMISSION_OVERRIDE_SET'
  | 'PERMISSION_OVERRIDE_CLEAR'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'PROFILE_UPDATE'
  | 'STUDENT_CREATE'
  | 'STUDENT_UPDATE'
  | 'STUDENT_TRANSFER'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE';

export interface AuditLogEntry {
  id:            string;
  action_type:   AuditActionType;
  target_table:  string;
  record_id:     string;
  old_values:    string | null;
  new_values:    string | null;
  context:       Record<string, unknown> | null;
  created_at:    string;
  actor_profile: { id: string; full_name: string } | null;
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

interface TenantContext {
  userId:   string;
  schoolId: string;
}

async function resolveTenantContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<TenantContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated access attempt.');

  // Prefer JWT fast path (zero extra DB call)
  const jwtSchoolId    = user.app_metadata?.school_id    as string  | undefined;
  const jwtSuperAdmin  = user.app_metadata?.is_super_admin as boolean | undefined;

  if (jwtSchoolId && jwtSuperAdmin) {
    return { userId: user.id, schoolId: jwtSchoolId };
  }

  // Fallback: read from profiles (first login before JWT is synced)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('school_id, is_super_admin')
    .eq('id', user.id)
    .single();

  if (error || !profile?.school_id) {
    throw new Error('Unauthorized: Tenant resolution failed.');
  }
  if (!profile.is_super_admin) {
    throw new Error('Unauthorized: Super Admin access required.');
  }

  return { userId: user.id, schoolId: profile.school_id as string };
}

// ============================================================================
// FETCHERS: ROLE DEFINITIONS
// ============================================================================

/**
 * All active admin_role_definitions for the school.
 * The Super Admin manages these — create, edit, delete.
 */
export async function getSchoolRoles(): Promise<RoleWithPermissions[]> {
  const supabase = await createSupabaseServerClient();
  const { schoolId } = await resolveTenantContext(supabase);

  const { data, error } = await supabase
    .from('admin_role_definitions')
    .select('id, label, description, baseline_permissions, created_at')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[getSchoolRoles]', error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const tokens = (row.baseline_permissions as string[]) ?? [];
    return {
      id:          row.id          as string,
      role_name:   row.label       as string,
      description: (row.description as string) ?? '',
      created_at:  row.created_at  as string,
      permissions: tokens.map((token) => ({
        permission_id:   token,
        permission_name: token,
        category:        token.split(':')[0] ?? 'general',
      })),
    };
  });
}

/**
 * Full permission_catalog — every valid domain-action token.
 * Used to render the permission picker UI for the Super Admin.
 */
export async function getSystemPermissionsCatalog(): Promise<SystemPermission[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('permission_catalog')
    .select('id, label, domain, description, sort_order')
    .order('domain',      { ascending: true })
    .order('sort_order',  { ascending: true });

  if (error) {
    console.error('[getSystemPermissionsCatalog]', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id:              row.id          as string,
    permission_name: row.label       as string,
    category:        row.domain      as string,
    description:     (row.description as string) ?? '',
  }));
}

// ============================================================================
// FETCHERS: STAFF ACCESS DIRECTORY
//
// Two-query strategy (see file header for why).
// ============================================================================

export async function getStaffAccessDirectory(
  filter: 'active' | 'transferred' | 'all' = 'active'
): Promise<StaffAccessProfile[]> {
  const supabase     = await createSupabaseServerClient();
  const { schoolId } = await resolveTenantContext(supabase);

  // ── Query 1: teachers + linked profiles ──────────────────────────────────
  let teacherQuery = supabase
    .from('teachers')
    .select(`
      id,
      school_id,
      staff_id,
      tsc_number,
      status,
      transfer_destination_school,
      transfer_date,
      created_at,
      profiles!profiles_teacher_id_fkey (
        id,
        full_name,
        email,
        phone_number,
        allowed_permissions_override,
        denied_permissions_override
      )
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (filter === 'active')      teacherQuery = teacherQuery.eq('status', 'active');
  if (filter === 'transferred') teacherQuery = teacherQuery.eq('status', 'transferred');

  const { data: teachers, error: teacherError } = await teacherQuery;

  if (teacherError) {
    console.error('[getStaffAccessDirectory] teachers:', teacherError.message);
    return [];
  }

  const rawTeachers = (teachers ?? []) as unknown as RawTeacherRow[];

  // Collect all profile IDs for the second query
  const profileIds = rawTeachers
    .map((t) => t.profiles?.id)
    .filter((id): id is string => Boolean(id));

  // ── Query 2: active role assignments for those profiles ───────────────────
  const assignmentMap: Record<string, RawRoleAssignment[]> = {};

  if (profileIds.length > 0) {
    const { data: assignments, error: assignError } = await supabase
      .from('staff_role_assignments')
      .select(`
        profile_id,
        role_id,
        revoked_at,
        admin_role_definitions (
          id,
          label
        )
      `)
      .in('profile_id', profileIds)
      .is('revoked_at', null);

    if (assignError) {
      console.error('[getStaffAccessDirectory] assignments:', assignError.message);
    } else {
      for (const a of assignments ?? []) {
        const pid = a.profile_id as string;
        if (!assignmentMap[pid]) assignmentMap[pid] = [];
        assignmentMap[pid]!.push(a as unknown as RawRoleAssignment);
      }
    }
  }

  // ── Merge ─────────────────────────────────────────────────────────────────
  return rawTeachers.map((teacher) =>
    normalizeStaffRow(
      teacher,
      assignmentMap[teacher.profiles?.id ?? ''] ?? []
    )
  );
}

/**
 * Single teacher's full security profile — for the slide-over editor.
 */
export async function getStaffSecurityProfile(
  teacherId: string
): Promise<StaffAccessProfile | null> {
  const supabase = await createSupabaseServerClient();

  // Query 1: teacher + profile
  const { data: teacher, error: teacherError } = await supabase
    .from('teachers')
    .select(`
      id,
      school_id,
      staff_id,
      tsc_number,
      status,
      transfer_destination_school,
      transfer_date,
      created_at,
      profiles!profiles_teacher_id_fkey (
        id,
        full_name,
        email,
        phone_number,
        allowed_permissions_override,
        denied_permissions_override
      )
    `)
    .eq('id', teacherId)
    .single();

  if (teacherError || !teacher) {
    console.error(`[getStaffSecurityProfile] id=${teacherId}:`, teacherError?.message);
    return null;
  }

  const raw       = teacher as unknown as RawTeacherRow;
  const profileId = raw.profiles?.id;

  // Query 2: active role assignments for this profile
  let assignments: RawRoleAssignment[] = [];

  if (profileId) {
    const { data: rawAssignments, error: assignError } = await supabase
      .from('staff_role_assignments')
      .select(`
        profile_id,
        role_id,
        revoked_at,
        admin_role_definitions (
          id,
          label
        )
      `)
      .eq('profile_id', profileId)
      .is('revoked_at', null);

    if (assignError) {
      console.error(`[getStaffSecurityProfile] assignments:`, assignError.message);
    } else {
      assignments = (rawAssignments ?? []) as unknown as RawRoleAssignment[];
    }
  }

  return normalizeStaffRow(raw, assignments);
}

// ── Shared normalizer ─────────────────────────────────────────────────────────

function normalizeStaffRow(
  teacher:     RawTeacherRow,
  assignments: RawRoleAssignment[]
): StaffAccessProfile {
  const profile = teacher.profiles ?? null;
  const allowed = profile?.allowed_permissions_override ?? [];
  const denied  = profile?.denied_permissions_override  ?? [];

  return {
    id:                          teacher.id,
    profile_id:                  profile?.id          ?? null,
    staff_id:                    teacher.staff_id      ?? null,
    full_name:                   profile?.full_name    ?? '',
    tsc_number:                  teacher.tsc_number    ?? null,
    email:                       profile?.email        ?? null,
    phone_number:                profile?.phone_number ?? null,
    status:                      teacher.status,
    transfer_destination_school: teacher.transfer_destination_school ?? null,
    transfer_date:               teacher.transfer_date               ?? null,
    roles: assignments
      .filter((a) => a.admin_role_definitions !== null)
      .map((a) => ({
        id:        a.admin_role_definitions!.id,
        role_name: a.admin_role_definitions!.label,
      })),
    overrides: [
      ...allowed.map((token) => ({
        permission_id:   token,
        permission_name: token,
        has_access:      true,
      })),
      ...denied.map((token) => ({
        permission_id:   token,
        permission_name: token,
        has_access:      false,
      })),
    ],
  };
}

// ============================================================================
// FETCHERS: AUDIT LEDGER
// ============================================================================

/**
 * Security audit trail for the school — newest first.
 * Read-only. Insert-only table by RLS design.
 */
export async function getSecurityAuditLogs(
  limit = 50
): Promise<AuditLogEntry[]> {
  const supabase     = await createSupabaseServerClient();
  const { schoolId } = await resolveTenantContext(supabase);

  const { data, error } = await supabase
    .from('security_audit_logs')
    .select(`
      id,
      action_type,
      target_table,
      record_id,
      old_values,
      new_values,
      context,
      created_at,
      actor_profile:profiles!audit_logs_actor_profiles_fkey (
        id,
        full_name
      )
    `)
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[getSecurityAuditLogs]', error.message);
    return [];
  }

  return (data as unknown as RawAuditRow[]).map((row) => ({
    id:            row.id,
    action_type:   row.action_type,
    target_table:  row.target_table,
    record_id:     row.record_id,
    old_values:    row.old_values,
    new_values:    row.new_values,
    context:       row.context ?? null,
    created_at:    row.created_at,
    actor_profile: row.actor_profile ?? null,
  }));
}