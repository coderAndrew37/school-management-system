"use server";

// lib/actions/fees.ts
// Admin-only fee management — fee structures, record payments, bulk generation.
// No parent-facing write actions. No payment prompts to parents.

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/actions/auth";
import { z } from "zod";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Schemas ───────────────────────────────────────────────────────────────────

const feeStructureSchema = z.object({
  grade: z.string().min(1),
  term: z.number().int().min(1).max(3),
  academic_year: z.number().int().min(2020).max(2100),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().max(200).optional(),
});

const recordPaymentSchema = z.object({
  student_id: z.string().uuid(),
  term: z.number().int().min(1).max(3),
  academic_year: z.number().int(),
  amount: z.number().positive(),
  payment_method: z
    .enum(["cash", "mpesa", "bank_transfer", "cheque", "other"])
    .default("cash"),
  reference_number: z.string().max(60).optional(),
  notes: z.string().max(300).optional(),
  paid_at: z.string().optional(), // ISO date string
});

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeeStructure {
  id: string;
  grade: string;
  term: number;
  academic_year: number;
  amount: number;
  description: string | null;
  created_at: string;
}

export interface FeeRecord {
  id: string;
  student_id: string;
  student_name: string;
  grade: string;
  term: number;
  academic_year: number;
  amount: number;
  status: string;
  payment_method: string | null;
  reference_number: string | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface GradeFeeStats {
  grade: string;
  term: number;
  academic_year: number;
  total_students: number;
  paid_count: number;
  pending_count: number;
  total_collected: number;
  total_outstanding: number;
  fee_amount: number;
}

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ── Fee Structures ─────────────────────────────────────────────────────────────

export async function fetchFeeStructures(
  academic_year: number,
): Promise<FeeStructure[]> {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("fee_structures")
    .select("id, grade, term, academic_year, amount, description, created_at")
    .eq("academic_year", academic_year)
    .order("grade")
    .order("term");
  if (error) {
    console.error("[fetchFeeStructures]", error.message);
    return [];
  }
  return (data ?? []) as FeeStructure[];
}

export async function upsertFeeStructureAction(input: {
  grade: string;
  term: number;
  academic_year: number;
  amount: number;
  description?: string;
}): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const parsed = feeStructureSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };

  const { error } = await supabaseAdmin
    .from("fee_structures")
    .upsert(parsed.data, { onConflict: "grade,term,academic_year" });

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/fees");
  return { success: true };
}

export async function deleteFeeStructureAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("fee_structures")
    .delete()
    .eq("id", id);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/fees");
  return { success: true };
}

// ── Fee Payments ──────────────────────────────────────────────────────────────

export async function fetchFeeRecords(
  academic_year: number,
  grade?: string,
  term?: number,
): Promise<FeeRecord[]> {
  await requireAdmin();

  let q = supabaseAdmin
    .from("fee_payments")
    .select(
      `
      id, student_id, amount, status, term, academic_year,
      payment_method, reference_number, notes, paid_at, created_at,
      students ( full_name, current_grade )
    `,
    )
    .eq("academic_year", academic_year)
    .order("created_at", { ascending: false });

  if (grade) q = q.eq("students.current_grade", grade);
  if (term) q = q.eq("term", term);

  const { data, error } = await q;
  if (error) {
    console.error("[fetchFeeRecords]", error.message);
    return [];
  }

  return (data ?? []).map((r: any) => ({
    id: r.id,
    student_id: r.student_id,
    student_name: r.students?.full_name ?? "Unknown",
    grade: r.students?.current_grade ?? "—",
    term: r.term,
    academic_year: r.academic_year,
    amount: r.amount,
    status: r.status,
    payment_method: r.payment_method,
    reference_number: r.reference_number,
    notes: r.notes,
    paid_at: r.paid_at,
    created_at: r.created_at,
  }));
}

export async function recordPaymentAction(input: {
  student_id: string;
  term: number;
  academic_year: number;
  amount: number;
  payment_method?: string;
  reference_number?: string;
  notes?: string;
  paid_at?: string;
}): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };

  const {
    student_id,
    term,
    academic_year,
    amount,
    payment_method,
    reference_number,
    notes,
    paid_at,
  } = parsed.data;

  // Upsert: if a record exists for this student+term+year, update it; else insert
  const { error } = await supabaseAdmin.from("fee_payments").upsert(
    {
      student_id,
      term,
      academic_year,
      amount,
      status: "paid",
      payment_method: payment_method ?? "cash",
      reference_number: reference_number ?? null,
      notes: notes ?? null,
      paid_at: paid_at ?? new Date().toISOString(),
    },
    { onConflict: "student_id,term,academic_year" },
  );

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/fees");
  return { success: true };
}

export async function updatePaymentStatusAction(
  paymentId: string,
  status: "paid" | "pending" | "partial" | "waived",
): Promise<{ success: boolean; error?: string }> {
  await requireAdmin();
  const { error } = await supabaseAdmin
    .from("fee_payments")
    .update({
      status,
      paid_at: status === "paid" ? new Date().toISOString() : null,
    })
    .eq("id", paymentId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/fees");
  return { success: true };
}

// ── Bulk fee generation ───────────────────────────────────────────────────────
// Creates a fee_payment record (status=pending) for every student in a grade
// based on the fee structure for that grade/term/year.
// Skips students who already have a record for that term.

export async function bulkGenerateFeeRecordsAction(
  grade: string,
  term: number,
  academic_year: number,
): Promise<{
  success: boolean;
  created: number;
  skipped: number;
  error?: string;
}> {
  await requireAdmin();

  // 1. Get fee structure
  const { data: structure } = await supabaseAdmin
    .from("fee_structures")
    .select("amount")
    .eq("grade", grade)
    .eq("term", term)
    .eq("academic_year", academic_year)
    .maybeSingle();

  if (!structure) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: `No fee structure found for ${grade} Term ${term} ${academic_year}. Create one first.`,
    };
  }

  // 2. Get all students in grade
  const { data: students } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("current_grade", grade);

  if (!students?.length) {
    return {
      success: false,
      created: 0,
      skipped: 0,
      error: "No students found in this grade.",
    };
  }

  // 3. Get existing payment records to skip
  const { data: existing } = await supabaseAdmin
    .from("fee_payments")
    .select("student_id")
    .eq("term", term)
    .eq("academic_year", academic_year)
    .in(
      "student_id",
      students.map((s) => s.id),
    );

  const existingIds = new Set((existing ?? []).map((e: any) => e.student_id));
  const toCreate = students.filter((s) => !existingIds.has(s.id));

  if (toCreate.length === 0) {
    return { success: true, created: 0, skipped: students.length };
  }

  // 4. Bulk insert
  const { error } = await supabaseAdmin.from("fee_payments").insert(
    toCreate.map((s) => ({
      student_id: s.id,
      term,
      academic_year,
      amount: structure.amount,
      status: "pending",
      payment_method: null,
    })),
  );

  if (error)
    return {
      success: false,
      created: 0,
      skipped: existingIds.size,
      error: error.message,
    };

  revalidatePath("/admin/fees");
  return { success: true, created: toCreate.length, skipped: existingIds.size };
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

export async function fetchFeeDashboardStats(academic_year: number): Promise<{
  totalCollected: number;
  totalOutstanding: number;
  totalStudents: number;
  paidCount: number;
  pendingCount: number;
  gradeBreakdown: GradeFeeStats[];
}> {
  await requireAdmin();

  const { data: payments } = await supabaseAdmin
    .from("fee_payments")
    .select(`amount, status, term, students ( current_grade )`)
    .eq("academic_year", academic_year);

  const { data: structures } = await supabaseAdmin
    .from("fee_structures")
    .select("grade, term, amount")
    .eq("academic_year", academic_year);

  const structureMap = new Map<string, number>();
  for (const s of structures ?? []) {
    structureMap.set(
      `${(s as any).grade}||${(s as any).term}`,
      (s as any).amount,
    );
  }

  const { data: allStudents } = await supabaseAdmin
    .from("students")
    .select("id, current_grade");

  let totalCollected = 0,
    totalOutstanding = 0,
    paidCount = 0,
    pendingCount = 0;
  const gradeBuckets = new Map<string, GradeFeeStats>();

  for (const p of (payments ?? []) as any[]) {
    const grade = p.students?.current_grade ?? "Unknown";
    const feeAmt = structureMap.get(`${grade}||${p.term}`) ?? p.amount;
    const key = `${grade}||${p.term}`;

    if (!gradeBuckets.has(key)) {
      gradeBuckets.set(key, {
        grade,
        term: p.term,
        academic_year,
        total_students: 0,
        paid_count: 0,
        pending_count: 0,
        total_collected: 0,
        total_outstanding: 0,
        fee_amount: feeAmt,
      });
    }
    const bucket = gradeBuckets.get(key)!;
    bucket.total_students++;

    if (p.status === "paid") {
      totalCollected += p.amount;
      paidCount++;
      bucket.paid_count++;
      bucket.total_collected += p.amount;
    } else {
      totalOutstanding += feeAmt;
      pendingCount++;
      bucket.pending_count++;
      bucket.total_outstanding += feeAmt;
    }
  }

  return {
    totalCollected,
    totalOutstanding,
    totalStudents: allStudents?.length ?? 0,
    paidCount,
    pendingCount,
    gradeBreakdown: Array.from(gradeBuckets.values()).sort((a, b) =>
      a.grade.localeCompare(b.grade),
    ),
  };
}

// ── Student fee lookup ────────────────────────────────────────────────────────
// Used by record-payment modal to find a student

export async function searchStudentsForFees(query: string) {
  await requireAdmin();
  if (query.trim().length < 2) return [];

  const { data } = await supabaseAdmin
    .from("students")
    .select("id, full_name, current_grade, readable_id")
    .or(`full_name.ilike.%${query}%,readable_id.ilike.%${query}%`)
    .order("full_name")
    .limit(10);

  return (data ?? []) as {
    id: string;
    full_name: string;
    current_grade: string;
    readable_id: string | null;
  }[];
}
