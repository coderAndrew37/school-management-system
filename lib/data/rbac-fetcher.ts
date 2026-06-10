// lib/data/rbac-fetchers.ts
// Kibali Academy — RBAC Data Fetcher Layer
//
// Schema recap (split-table strategy):
//   teachers   — institutional employment telemetry (school-scoped)
//   profiles   — application user identity, permission overrides, teacher_id FK
//   admin_role_definitions (COMPOSITE PK: school_id + id) — tenant-scoped role templates
//   staff_role_assignments — profile ↔ role linkage (soft-delete lifecycle)
//   permission_catalog     — master domain-action token registry
//   security_audit_logs    — tamper-proof audit trail
//
// Effective permission equation (enforced in JWT sync trigger, mirrored here for UI):
//   Effective = (baseline_role_tokens ∪ allowed_permissions_override) \ denied_permissions_override
//
// Two-query strategy for staff directory:
//   PostgREST cannot traverse teachers→profiles→staff_role_assignments in one hop.
//   Query 1: teachers + profiles (FK hop via profiles.teacher_id)
//   Query 2: staff_role_assignments + admin_role_definitions for the resolved profile IDs
//   Merge in TypeScript.
//
// ── Auth-layer split ──────────────────────────────────────────────────────────
// resolveSchoolId   (lib/data/teachers.ts) — used by teacher fetchers; requires
//   only a valid authenticated session, not super-admin. Regular admins can read
//   their own school's teacher list.
//
// resolveTenantContext (this file) — used by RBAC fetchers; requires super-admin
//   because it touches role definitions, permission overrides, and audit logs.
//   The two helpers intentionally stay in separate files with separate auth gates.
// ─────────────────────────────────────────────────────────────────────────────
//
// ── PostgREST back-reference join — critical type note ───────────────────────
// The FK `profiles_teacher_id_fkey` is defined ON the `profiles` table:
//   profiles.teacher_id → teachers.id
//
// When querying FROM `teachers`, the profiles join is a REVERSE / BACK-REFERENCE.
// PostgREST therefore always returns profiles as an ARRAY, even though exactly
// one profile exists per teacher in practice.
//
// RawTeacherRow.profiles is therefore typed as RawProfileJoin[] | null, and every
// consumer must call Array.isArray and take index [0] — identical to the pattern
// in lib/data/teachers.ts mapTeacherRow().
//
// The previous version typed profiles as RawProfileJoin | null (object), which
// silently produced undefined for every joined field.
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from '@/lib/supabase/server';

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
  id:                          string;        // teachers.id
  profile_id:                  string | null; // profiles.id
  staff_id:                    string | null;
  full_name:                   string;
  tsc_number:                  string | null;
  email:                       string | null;
  phone_number:                string | null;
  status:                      TeacherStatus;
  transfer_destination_school: string | null;
  transfer_date:               string | null;
  roles: {
    id:        string;
    role_name: string;
  }[];
  overrides: {
    permission_id:   string;
    permission_name: string;
    has_access:      boolean;
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

/**
 * Shape of a single profiles row as returned by the back-reference join.
 * Includes the RBAC-specific override columns not needed by teacher fetchers.
 */
interface RawProfileJoin {
  id:                           string;
  full_name:                    string;
  email:                        string | null;
  phone_number:                 string | null;
  allowed_permissions_override: string[];
  denied_permissions_override:  string[];
}

/**
 * FIX: profiles is RawProfileJoin[] | null, NOT RawProfileJoin | null.
 *
 * The FK profiles_teacher_id_fkey is defined on the profiles table, making this
 * a back-reference join when querying from teachers. PostgREST always returns an
 * array for back-reference joins — identical to the behaviour documented and
 * handled in lib/data/teachers.ts. Typing it as a plain object caused every
 * joined field (full_name, email, etc.) to silently resolve to undefined.
 */
interface RawTeacherRow {
  id:                          string;
  school_id:                   string;
  staff_id:                    string | null;
  tsc_number:                  string | null;
  status:                      TeacherStatus;
  transfer_destination_school: string | null;
  transfer_date:               string | null;
  created_at:                  string;
  profiles:                    RawProfileJoin[] | null; // ← array, not object
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
// INTERNAL HELPERS
// ============================================================================

interface TenantContext {
  userId:       string;
  schoolId:     string;
  isSuperAdmin: boolean;
}

/**
 * Resolves school context for RBAC operations.
 * Enforces super-admin — contrast with resolveSchoolId() in lib/data/teachers.ts
 * which only requires a valid session (regular admins can read their teacher list).
 */
async function resolveTenantContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<TenantContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated access attempt.');

  // JWT fast path — zero extra DB call once the trigger has synced
  const jwtSchoolId   = user.app_metadata?.school_id     as string  | undefined;
  const jwtSuperAdmin = user.app_metadata?.is_super_admin as boolean | undefined;

  if (jwtSchoolId && jwtSuperAdmin) {
    return { userId: user.id, schoolId: jwtSchoolId, isSuperAdmin: true };
  }

  // Fallback: profiles table (first login, before JWT trigger has fired)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('school_id, is_super_admin')
    .eq('id', user.id)
    .single();

  if (error || !profile?.school_id) throw new Error('Unauthorized: Tenant resolution failed.');
  if (!profile.is_super_admin) throw new Error('Unauthorized: Super Admin access required.');

  return { userId: user.id, schoolId: profile.school_id as string, isSuperAdmin: true };
}

// ============================================================================
// FETCHERS: ROLE DEFINITIONS
// ============================================================================

/**
 * All active admin_role_definitions for the current school.
 * Composite PK (school_id, id) — always scope by school_id.
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

  if (error) { console.error('[getSchoolRoles]', error.message); return []; }

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
 * All roles for this school including inactive — used by the role configurator.
 */
export async function getAllSchoolRoles(): Promise<RoleWithPermissions[]> {
  const supabase = await createSupabaseServerClient();
  const { schoolId } = await resolveTenantContext(supabase);

  const { data, error } = await supabase
    .from('admin_role_definitions')
    .select('id, label, description, baseline_permissions, created_at, is_active')
    .eq('school_id', schoolId)
    .order('sort_order', { ascending: true });

  if (error) { console.error('[getAllSchoolRoles]', error.message); return []; }

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
 * Used to render the permission picker UI.
 */
export async function getSystemPermissionsCatalog(): Promise<SystemPermission[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('permission_catalog')
    .select('id, label, domain, description, sort_order')
    .order('domain',     { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) { console.error('[getSystemPermissionsCatalog]', error.message); return []; }

  return (data ?? []).map((row) => ({
    id:              row.id          as string,
    permission_name: row.label       as string,
    category:        row.domain      as string,
    description:     (row.description as string) ?? '',
  }));
}

// ============================================================================
// FETCHERS: STAFF ACCESS DIRECTORY
// Two-query strategy — see file header for rationale.
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

  // Collect profile IDs for the second query — pluck index [0] from the array join
  const profileIds = rawTeachers
    .map((t) => (Array.isArray(t.profiles) ? t.profiles[0]?.id : undefined))
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
  return rawTeachers.map((teacher) => {
    const profile   = Array.isArray(teacher.profiles) ? teacher.profiles[0] ?? null : null;
    const profileId = profile?.id ?? '';
    return normalizeStaffRow(teacher, profile, assignmentMap[profileId] ?? []);
  });
}

/**
 * Single teacher's full security profile — for the slide-over editor.
 */
export async function getStaffSecurityProfile(
  teacherId: string
): Promise<StaffAccessProfile | null> {
  const supabase = await createSupabaseServerClient();

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

  const raw = teacher as unknown as RawTeacherRow;

  // FIX: back-reference join returns array — take index [0]
  const profile = Array.isArray(raw.profiles) ? raw.profiles[0] ?? null : null;
  const profileId = profile?.id;

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

  return normalizeStaffRow(raw, profile, assignments);
}

// ── Shared normalizer ─────────────────────────────────────────────────────────
// Profile is passed in already resolved (index [0] taken by callers above),
// so this function receives RawProfileJoin | null — not the raw array.

function normalizeStaffRow(
  teacher:     RawTeacherRow,
  profile:     RawProfileJoin | null,
  assignments: RawRoleAssignment[]
): StaffAccessProfile {
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

export async function getSecurityAuditLogs(limit = 50): Promise<AuditLogEntry[]> {
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

  if (error) { console.error('[getSecurityAuditLogs]', error.message); return []; }

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