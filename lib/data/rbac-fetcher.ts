// lib/data/rbac-fetchers.ts
// Kibali Academy — RBAC Data Fetcher Layer (new schema)
//
// Aligned to:
//   - admin_role_definitions  (replaces old roles table)
//   - staff_role_assignments  (replaces old user_roles — soft-delete lifecycle)
//   - profiles.allowed/denied_permissions_override  (replaces user_permissions table)
//   - permission_catalog  (replaces old permissions table)
//   - security_audit_logs with new audit_action_type enum

import { createSupabaseServerClient } from '@/lib/supabase/server';

// ============================================================================
// INTERNAL JOIN SHAPES
// ============================================================================

interface RawRoleAssignmentJoin {
  role_id:    string;
  revoked_at: string | null;
  admin_role_definitions: {
    id:    string;
    label: string;
  } | null;
}

interface RawTeacherRow {
  id:                          string;
  full_name:                   string;
  tsc_number:                  string | null;
  email:                       string;
  phone_number:                string | null;
  status:                      TeacherStatus;
  transfer_destination_school: string | null;
  transfer_date:               string | null;
  // Link back to the profiles row that owns permission overrides
  profiles: {
    id:                           string;
    allowed_permissions_override: string[];
    denied_permissions_override:  string[];
  } | null;
  // Active role assignments
  staff_role_assignments: RawRoleAssignmentJoin[];
}

interface RawAuditActorJoin {
  id:        string;
  full_name: string;
}

interface RawAuditRow {
  id:           string;
  action_type:  AuditLogEntry['action_type'];
  target_table: string;
  record_id:    string;
  old_values:   string | null;
  new_values:   string | null;
  context:      Record<string, unknown> | null;
  created_at:   string;
  actor_profile: RawAuditActorJoin | null;
}

// ============================================================================
// EXPORTED TYPES
// ============================================================================

// Teacher status — full set from the existing teachers table
export type TeacherStatus =
  | 'active'
  | 'on_leave'
  | 'transferred'
  | 'terminated'
  | 'resigned'
  | 'deceased'
  | 'retired'
  | 'suspended';

// Represents a row from admin_role_definitions + its baseline permissions
export interface RoleWithPermissions {
  id:                   string;   // slug: 'bursar', 'dos'
  role_name:            string;   // mapped from label for UI compatibility
  description:          string;
  created_at:           string;
  // Baseline permission tokens (domain:subdomain:action strings)
  permissions: {
    permission_id:   string;   // token id e.g. 'finance:fees:read'
    permission_name: string;   // same as id — token IS the name
    category:        string;   // domain segment e.g. 'finance'
  }[];
}

export interface SystemPermission {
  id:              string;   // 'finance:fees:read'
  permission_name: string;   // same as id
  category:        string;   // domain: 'finance', 'academics', etc.
  description:     string;
}

// Staff profile enriched with active role assignments and permission overrides
// Overrides are now read from profiles.allowed/denied_permissions_override columns,
// not from a separate user_permissions table.
export interface StaffAccessProfile {
  id:                          string;   // teachers.id
  profile_id:                  string | null;  // profiles.id (may differ from teachers.id)
  full_name:                   string;
  tsc_number:                  string | null;
  email:                       string;
  phone_number:                string | null;
  status:                      TeacherStatus;
  transfer_destination_school: string | null;
  transfer_date:               string | null;
  // Active role assignments (non-revoked)
  roles: {
    id:        string;   // role slug
    role_name: string;   // role label
  }[];
  // Flattened from profiles override columns for the editor UI
  // has_access: true = allowed_permissions_override, false = denied_permissions_override
  overrides: {
    permission_id:   string;
    permission_name: string;
    has_access:      boolean;
  }[];
}

// New audit_action_type enum values (aligned to migration.sql)
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
// FETCHERS: ROLE DEFINITIONS ENGINE
// ============================================================================

/**
 * Fetches admin_role_definitions for the school tenant.
 * Maps to RoleWithPermissions for UI compatibility.
 * baseline_permissions tokens are mapped to the permissions array shape.
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
      id:          row.id as string,
      role_name:   row.label as string,
      description: (row.description as string) ?? '',
      created_at:  row.created_at as string,
      permissions: tokens.map((token) => ({
        permission_id:   token,
        permission_name: token,
        category:        token.split(':')[0] ?? 'general',
      })),
    };
  });
}

/**
 * Fetches the permission_catalog — all valid domain-action tokens.
 */
export async function getSystemPermissionsCatalog(): Promise<SystemPermission[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('permission_catalog')
    .select('id, label, domain, description')
    .order('domain',    { ascending: true })
    .order('subdomain', { ascending: true })
    .order('action',    { ascending: true });

  if (error) {
    console.error('[getSystemPermissionsCatalog]', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id:              row.id as string,
    permission_name: row.id as string,
    category:        row.domain as string,
    description:     (row.description as string) ?? '',
  }));
}

// ============================================================================
// FETCHERS: STAFF ACCESS
// ============================================================================

/**
 * Loads teacher rows with their active role assignments and permission overrides.
 * Overrides are read from profiles.allowed/denied_permissions_override columns.
 */
export async function getStaffAccessDirectory(
  filter: 'active' | 'transferred' | 'all' = 'active'
): Promise<StaffAccessProfile[]> {
  const supabase = await createSupabaseServerClient();
  const { schoolId } = await resolveTenantContext(supabase);

  let query = supabase
    .from('teachers')
    .select(`
      id,
      full_name,
      tsc_number,
      email,
      phone_number,
      status,
      transfer_destination_school,
      transfer_date,
      profiles!profiles_teacher_id_fkey (
        id,
        allowed_permissions_override,
        denied_permissions_override
      ),
      staff_role_assignments!staff_role_assignments_profile_id_fkey (
        role_id,
        revoked_at,
        admin_role_definitions (
          id,
          label
        )
      )
    `)
    .eq('school_id', schoolId);

  if (filter === 'active')      query = query.eq('status', 'active');
  if (filter === 'transferred') query = query.eq('status', 'transferred');

  const { data, error } = await query.order('full_name', { ascending: true });

  if (error) {
    console.error('[getStaffAccessDirectory]', error.message);
    return [];
  }

  return (data as unknown as RawTeacherRow[]).map(normalizeStaffRow);
}

/**
 * Loads a single teacher's full security profile for the slide-over editor.
 */
export async function getStaffSecurityProfile(
  teacherId: string
): Promise<StaffAccessProfile | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('teachers')
    .select(`
      id,
      full_name,
      tsc_number,
      email,
      phone_number,
      status,
      transfer_destination_school,
      transfer_date,
      profiles!profiles_teacher_id_fkey (
        id,
        allowed_permissions_override,
        denied_permissions_override
      ),
      staff_role_assignments!staff_role_assignments_profile_id_fkey (
        role_id,
        revoked_at,
        admin_role_definitions (
          id,
          label
        )
      )
    `)
    .eq('id', teacherId)
    .single();

  if (error || !data) {
    console.error(`[getStaffSecurityProfile] id=${teacherId}:`, error?.message);
    return null;
  }

  return normalizeStaffRow(data as unknown as RawTeacherRow);
}

// Internal normalizer — shared by both staff fetchers
function normalizeStaffRow(teacher: RawTeacherRow): StaffAccessProfile {
  const profile = teacher.profiles ?? null;

  // Active assignments only (revoked_at IS NULL)
  const activeAssignments = (teacher.staff_role_assignments ?? []).filter(
    (a) => a.revoked_at === null
  );

  // Flatten override arrays from profile columns into the override shape the UI expects
  const allowed = profile?.allowed_permissions_override ?? [];
  const denied  = profile?.denied_permissions_override  ?? [];

  const overrides = [
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
  ];

  return {
    id:                          teacher.id,
    profile_id:                  profile?.id ?? null,
    full_name:                   teacher.full_name,
    tsc_number:                  teacher.tsc_number,
    email:                       teacher.email,
    phone_number:                teacher.phone_number,
    status:                      teacher.status,
    transfer_destination_school: teacher.transfer_destination_school,
    transfer_date:               teacher.transfer_date,
    roles: activeAssignments
      .filter((a) => a.admin_role_definitions !== null)
      .map((a) => ({
        id:        a.admin_role_definitions!.id,
        role_name: a.admin_role_definitions!.label,
      })),
    overrides,
  };
}

// ============================================================================
// FETCHERS: AUDIT LEDGER
// ============================================================================

/**
 * Returns the tamper-proof security audit trail for the school tenant.
 * Ordered newest-first. Includes the context JSONB column for rich display.
 */
export async function getSecurityAuditLogs(
  limit = 50
): Promise<AuditLogEntry[]> {
  const supabase = await createSupabaseServerClient();
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
      actor_profile:profiles!actor_id (
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