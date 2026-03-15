// lib/data/parents.ts
// Server-side data fetching for the admin parents management page.
// Separated from dashboard.ts to keep concerns focused.

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Parent,
  ParentFeeBalance,
  ParentNotificationSummary,
} from "@/lib/types/dashboard";

// ── Select fragment ────────────────────────────────────────────────────────────

const PARENT_SELECT = `
  id, full_name, email, phone_number, created_at,
  invite_accepted, last_invite_sent,
  student_parents (
    students ( id, full_name, current_grade, photo_url, status )
  )
` as const;

function mapParentRow(row: any): Parent {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone_number: row.phone_number ?? null,
    created_at: row.created_at,
    invite_accepted: row.invite_accepted ?? false,
    last_invite_sent: row.last_invite_sent ?? null,
    children: (row.student_parents ?? [])
      .map((sp: any) => sp.students)
      .filter(Boolean)
      .map((s: any) => ({
        id: s.id,
        full_name: s.full_name,
        current_grade: s.current_grade,
        photo_url: s.photo_url ?? null,
        status: s.status ?? "active",
      })),
  };
}

// ── Fetch all parents ─────────────────────────────────────────────────────────

export async function fetchAllParents(): Promise<Parent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("parents")
    .select(PARENT_SELECT)
    .order("full_name", { ascending: true });

  if (error) {
    console.error("fetchAllParents error:", error.message);
    return [];
  }
  return (data ?? []).map(mapParentRow);
}

// ── Fetch fee balances for a parent's children ────────────────────────────────
// Used in the parent drawer. Shows total paid vs total due per child.

export async function fetchParentFeeBalances(
  childIds: string[],
  academicYear = 2026,
): Promise<ParentFeeBalance[]> {
  if (childIds.length === 0) return [];

  const supabase = await createSupabaseServerClient();

  // Get all payments for these students
  const { data: payments } = await supabase
    .from("fee_payments")
    .select("student_id, amount, status")
    .in("student_id", childIds)
    .eq("academic_year", academicYear)
    .eq("status", "paid");

  // Get fee structures for relevant grades
  const { data: students } = await supabase
    .from("students")
    .select("id, full_name, current_grade")
    .in("id", childIds);

  const { data: feeStructures } = await supabase
    .from("fee_structures")
    .select("grade, term, academic_year, amount")
    .eq("academic_year", academicYear);

  const studentMap: Record<string, { name: string; grade: string }> = {};
  for (const s of (students ?? []) as any[]) {
    studentMap[s.id] = { name: s.full_name, grade: s.current_grade };
  }

  const paidMap: Record<string, number> = {};
  for (const p of (payments ?? []) as any[]) {
    paidMap[p.student_id] = (paidMap[p.student_id] ?? 0) + Number(p.amount);
  }

  const dueMap: Record<string, number> = {};
  for (const f of (feeStructures ?? []) as any[]) {
    for (const [sid, info] of Object.entries(studentMap)) {
      if (info.grade === f.grade) {
        dueMap[sid] = (dueMap[sid] ?? 0) + Number(f.amount);
      }
    }
  }

  return childIds.map((sid) => ({
    student_id: sid,
    student_name: studentMap[sid]?.name ?? "Unknown",
    total_paid: paidMap[sid] ?? 0,
    total_due: dueMap[sid] ?? 0,
    balance: (paidMap[sid] ?? 0) - (dueMap[sid] ?? 0),
  }));
}

// ── Fetch recent notifications sent to a parent's children ───────────────────

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
  for (const s of (students ?? []) as any[]) nameMap[s.id] = s.full_name;

  const { data: notifs } = await supabase
    .from("notifications")
    .select("id, student_id, title, body, type, is_read, created_at")
    .in("student_id", childIds)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (notifs ?? []).map((n: any) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    type: n.type,
    is_read: n.is_read,
    created_at: n.created_at,
    student_name: nameMap[n.student_id] ?? "Unknown",
  }));
}
