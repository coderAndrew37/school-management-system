// lib/data/parents.ts
// Kibali Academy — Parent Data Fetchers
//
// ARCHITECTURE NOTE — there is no `parents` table
// ─────────────────────────────────────────────────────────────────────────────
// Parents are rows in `profiles` where role = 'parent'.
// The student↔parent relationship lives in the `student_parents` junction table:
//
//   student_parents.parent_id → profiles.id   (FK: student_parents_parent_id_profiles_fkey)
//   student_parents.student_id → students.id  (FK: student_parents_student_id_fkey)
//
// To fetch all parents with their linked children we therefore query `profiles`
// filtered by role = 'parent', then join student_parents → students.
//
// The RLS policy `profiles_same_school_read` (school_id scoped, JWT-based)
// ensures only profiles within the authenticated user's school are returned.
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Parent,
  ParentFeeBalance,
  ParentNotificationSummary,
  StudentStatus,
} from "@/lib/types/dashboard";

// ============================================================================
// INTERNAL RAW ROW SHAPES
// ============================================================================

/**
 * A student row as returned by the nested join from student_parents → students.
 */
interface RawStudentLink {
  students: {
    id: string;
    full_name: string;
    current_grade: string;
    photo_url: string | null;
    status: string | null;
  } | null;
}

/**
 * Raw profile row for a parent, including their linked children via
 * student_parents. `student_parents` is an array because one parent can have
 * multiple children (back-reference join from profiles ← student_parents).
 */
interface RawParentRow {
  id: string;
  full_name: string;
  email: string | null;
  phone_number: string | null;
  created_at: string;
  // `invite_accepted` does not exist on profiles — we derive it from whether
  // the user has a confirmed auth.users row. For display purposes we read
  // `last_sign_in_at` absence as not accepted. Since we can't join auth.users
  // from the client, we leave this as null and treat null as false.
  student_parents: RawStudentLink[] | null;
}

interface RawFeePayment {
  student_id: string;
  amount: number;
  status: string;
}

interface RawFeeStructure {
  grade: string;
  term: number;
  academic_year: number;
  amount: number;
}

interface RawNotification {
  id: string;
  student_id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

// ============================================================================
// MAPPER
// ============================================================================

function mapParentRow(row: RawParentRow): Parent {
  return {
    id:               row.id,
    full_name:        row.full_name,
    email:            row.email ?? null,
    phone_number:     row.phone_number ?? null,
    created_at:       row.created_at,
    // profiles has no invite_accepted column; default to false.
    // If your schema tracks this elsewhere, replace with the correct field.
    invite_accepted:  false,
    last_invite_sent: null,
    children: (row.student_parents ?? [])
      .map((sp) => sp.students)
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .map((s) => ({
        id:            s.id,
        full_name:     s.full_name,
        current_grade: s.current_grade,
        photo_url:     s.photo_url ?? null,
        status:        (s.status as StudentStatus) ?? "active",
      })),
  };
}

/**
 * Select all parent profile rows scoped to the authenticated user's school
 * (enforced by the `profiles_same_school_read` RLS policy), including their
 * linked children via the student_parents junction.
 *
 * The nested join path is:
 *   profiles ← student_parents!student_parents_parent_id_profiles_fkey
 *             → students
 *
 * Because `student_parents.parent_id → profiles.id` is a back-reference from
 * profiles' perspective, PostgREST returns it as an array.
 */
const PARENT_SELECT = `
  id, full_name, email, phone_number, created_at,
  student_parents!student_parents_parent_id_profiles_fkey (
    students ( id, full_name, current_grade, photo_url, status )
  )
` as const;

// ============================================================================
// PUBLIC API
// ============================================================================

export async function fetchAllParents(): Promise<Parent[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(PARENT_SELECT)
    .eq("base_role", "parent") // Updated to track the unified base_role system
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[fetchAllParents] error:", error.message);
    return [];
  }

  return (data as unknown as RawParentRow[]).map(mapParentRow);
}

export async function fetchParentById(parentId: string): Promise<Parent | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(PARENT_SELECT)
    .eq("id", parentId)
    .eq("base_role", "parent")
    .maybeSingle();

  if (error) {
    console.error("[fetchParentById] error:", error.message);
    return null;
  }

  if (!data) return null;
  return mapParentRow(data as unknown as RawParentRow);
}

// ============================================================================
// FEE BALANCES
// ============================================================================

export async function fetchParentFeeBalances(
  childIds: string[],
  academicYear = 2026,
): Promise<ParentFeeBalance[]> {
  if (childIds.length === 0) return [];

  const supabase = await createSupabaseServerClient();

  const [paymentsRes, studentsRes, structuresRes] = await Promise.all([
    supabase
      .from("fee_payments")
      .select("student_id, amount, status")
      .in("student_id", childIds)
      .eq("academic_year", academicYear)
      .eq("status", "paid")
      .returns<RawFeePayment[]>(),
    supabase
      .from("students")
      .select("id, full_name, current_grade")
      .in("id", childIds),
    supabase
      .from("fee_structures")
      .select("grade, term, academic_year, amount")
      .eq("academic_year", academicYear)
      .returns<RawFeeStructure[]>(),
  ]);

  const studentMap: Record<string, { name: string; grade: string }> = {};
  for (const s of (studentsRes.data ?? [])) {
    studentMap[s.id] = { name: s.full_name, grade: s.current_grade };
  }

  const paidMap: Record<string, number> = {};
  for (const p of (paymentsRes.data ?? [])) {
    paidMap[p.student_id] = (paidMap[p.student_id] ?? 0) + Number(p.amount);
  }

  const dueMap: Record<string, number> = {};
  const feeStructures = structuresRes.data ?? [];

  for (const sid of childIds) {
    const info = studentMap[sid];
    if (!info) continue;
    dueMap[sid] = feeStructures
      .filter((f) => f.grade === info.grade)
      .reduce((acc, f) => acc + Number(f.amount), 0);
  }

  return childIds.map((sid) => ({
    student_id:  sid,
    total_paid:  paidMap[sid] ?? 0,
    total_due:   dueMap[sid]  ?? 0,
    balance:     (paidMap[sid] ?? 0) - (dueMap[sid] ?? 0),
  }));
}

// ============================================================================
// NOTIFICATION HISTORY
// ============================================================================

export async function fetchParentNotificationHistory(
  childIds: string[],
  limit = 5,
): Promise<ParentNotificationSummary[]> {
  if (childIds.length === 0) return [];

  const supabase = await createSupabaseServerClient();

  const { data: students } = await supabase
    .from("students")
    .select("id, full_name")
    .in("id", childIds);

  const nameMap: Record<string, string> = {};
  if (students) {
    for (const s of students) nameMap[s.id] = s.full_name;
  }

  const { data: notifs, error } = await supabase
    .from("notifications")
    .select("id, student_id, title, body, type, is_read, created_at")
    .in("student_id", childIds)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<RawNotification[]>();

  if (error) {
    console.error("[fetchParentNotificationHistory] error:", error.message);
    return [];
  }

  return (notifs ?? []).map((n) => ({
    id:           n.id,
    title:        n.title,
    body:         n.body,
    type:         n.type as ParentNotificationSummary["type"],
    is_read:      n.is_read,
    created_at:   n.created_at,
    student_name: nameMap[n.student_id] ?? "Unknown",
  }));
}