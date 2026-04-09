// lib/data/parents.ts
// Server-side data fetching for the admin parents management page.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Parent,
  ParentFeeBalance,
  ParentNotificationSummary,
  StudentStatus, // Imported to fix type casting
} from "@/lib/types/dashboard";

// ── 1. Raw DB row shapes ──────────────────────────────────────────────────────

interface RawStudentLink {
  students: {
    id: string;
    full_name: string;
    current_grade: string;
    photo_url: string | null;
    status: string | null;
  } | null;
}

interface RawParentRow {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  created_at: string;
  invite_accepted: boolean | null;
  last_invite_sent: string | null;
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
  type: string; // Will be cast to the specific union type
  is_read: boolean;
  created_at: string;
}

// ── 2. Mapper helpers ──────────────────────────────────────────────────────────

function mapParentRow(row: RawParentRow): Parent {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone_number: row.phone_number ?? null,
    created_at: row.created_at,
    invite_accepted: row.invite_accepted ?? false,
    last_invite_sent: row.last_invite_sent ?? null,
    children: (row.student_parents ?? [])
      .map((sp) => sp.students)
      .filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => ({
        id: s.id,
        full_name: s.full_name,
        current_grade: s.current_grade,
        photo_url: s.photo_url ?? null,
        // Cast string from DB to StudentStatus union type
        status: (s.status as StudentStatus) ?? "active",
      })),
  };
}

const PARENT_SELECT = `
  id, full_name, email, phone_number, created_at,
  invite_accepted, last_invite_sent,
  student_parents (
    students ( id, full_name, current_grade, photo_url, status )
  )
` as const;

// ── 3. Public API ──────────────────────────────────────────────────────────────

export async function fetchAllParents(): Promise<Parent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("parents")
    .select(PARENT_SELECT)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[fetchAllParents] error:", error.message);
    return [];
  }
  
  // Cast the unknown Supabase response to our local RawParentRow interface
  const rawData = data as unknown as RawParentRow[];
  return (rawData ?? []).map(mapParentRow);
}

/**
 * Fetch fee balances for a parent's children.
 */
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
    
    const totalForGrade = feeStructures
      .filter((f) => f.grade === info.grade)
      .reduce((acc, f) => acc + Number(f.amount), 0);
    
    dueMap[sid] = totalForGrade;
  }

  return childIds.map((sid) => ({
    student_id: sid,
    student_name: studentMap[sid]?.name ?? "Unknown",
    total_paid: paidMap[sid] ?? 0,
    total_due: dueMap[sid] ?? 0,
    balance: (paidMap[sid] ?? 0) - (dueMap[sid] ?? 0),
  }));
}

/**
 * Fetch recent notifications sent to a parent's children.
 */
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
    id: n.id,
    title: n.title,
    body: n.body,
    // Cast to the specific union type required by ParentNotificationSummary
    type: n.type as ParentNotificationSummary["type"],
    is_read: n.is_read,
    created_at: n.created_at,
    student_name: nameMap[n.student_id] ?? "Unknown",
  }));
}