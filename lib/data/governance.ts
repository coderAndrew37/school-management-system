// ─────────────────────────────────────────────────────────────────────────────
// lib/data/governance.ts
// Server-side data fetchers — all run with the SSR Supabase client
// ─────────────────────────────────────────────────────────────────────────────
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Announcement,
  SchoolEvent,
  InventoryItem,
  FeeStructure,
  FeePayment,
  GovernanceStats,
  StudentSummary,
  AttendanceOverview,
  AttendanceGradeSummary,
} from "@/lib/types/governance";

// ── Announcements ─────────────────────────────────────────────────────────────

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const supabase = await createSupabaseServerClient();

  // Fetch announcements without the profiles join — author_id references
  // auth.users directly, and PostgREST cannot auto-join to public.profiles
  // until migration 008 (governance_profile_fks) has been applied.
  // We resolve display names with a second query so this works in all states.
  const { data, error } = await supabase
    .from("announcements")
    .select("*")
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (error) {
    console.error("[fetchAnnouncements]", error.message);
    return [];
  }

  const rows = (data ?? []) as Omit<Announcement, "profiles">[];

  // Collect unique author_ids that are non-null
  const authorIds = [
    ...new Set(rows.map((r) => r.author_id).filter(Boolean)),
  ] as string[];

  // Resolve display names from profiles (best-effort — empty map if it fails)
  const nameMap: Record<string, string> = {};
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds);
    for (const p of (profiles ?? []) as {
      id: string;
      full_name: string | null;
    }[]) {
      if (p.full_name) nameMap[p.id] = p.full_name;
    }
  }

  return rows.map((r) => ({
    ...r,
    profiles: r.author_id ? { full_name: nameMap[r.author_id] ?? null } : null,
  })) as Announcement[];
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export async function fetchAllEvents(): Promise<SchoolEvent[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("school_events")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) {
    console.error("[fetchAllEvents]", error.message);
    return [];
  }
  return (data ?? []) as SchoolEvent[];
}

// ── Inventory ─────────────────────────────────────────────────────────────────

export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .order("category")
    .order("name");

  if (error) {
    console.error("[fetchInventoryItems]", error.message);
    return [];
  }
  return (data ?? []) as InventoryItem[];
}

// ── Fees ──────────────────────────────────────────────────────────────────────

export async function fetchFeeStructures(
  academicYear = 2026,
): Promise<FeeStructure[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("fee_structures")
    .select("*")
    .eq("academic_year", academicYear)
    .order("grade")
    .order("term");

  if (error) {
    console.error("[fetchFeeStructures]", error.message);
    return [];
  }
  return (data ?? []) as FeeStructure[];
}

export async function fetchFeePayments(
  academicYear = 2026,
): Promise<FeePayment[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("fee_payments")
    .select("*, students(full_name, readable_id, current_grade)")
    .eq("academic_year", academicYear)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[fetchFeePayments]", error.message);
    return [];
  }
  return (data ?? []) as FeePayment[];
}

// ── Students (fee payment form dropdown) ─────────────────────────────────────

export async function fetchStudentSummaries(): Promise<StudentSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, readable_id, current_grade")
    .order("current_grade")
    .order("full_name");

  if (error) {
    console.error("[fetchStudentSummaries]", error.message);
    return [];
  }
  return (data ?? []) as StudentSummary[];
}

// ── Attendance Overview (admin view) ──────────────────────────────────────────

export async function fetchAttendanceOverview(
  targetDate?: string,
): Promise<AttendanceOverview> {
  const supabase = await createSupabaseServerClient();

  const date = targetDate ?? new Date().toISOString().slice(0, 10);

  // Fetch today's attendance records
  const [recordsRes, studentsRes] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("student_id, grade, status")
      .eq("date", date)
      .eq("session", "full_day"),
    supabase.from("students").select("id, current_grade"),
  ]);

  const records = (recordsRes.data ?? []) as {
    student_id: string;
    grade: string;
    status: string;
  }[];
  const students = (studentsRes.data ?? []) as {
    id: string;
    current_grade: string;
  }[];

  // Build grade-level enrollment map
  const gradeEnrollment: Record<string, number> = {};
  for (const s of students) {
    gradeEnrollment[s.current_grade] =
      (gradeEnrollment[s.current_grade] ?? 0) + 1;
  }

  // Aggregate totals
  const present = records.filter((r) => r.status === "present").length;
  const late = records.filter((r) => r.status === "late").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const excused = records.filter((r) => r.status === "excused").length;

  // Per-grade breakdown
  const byGradeMap: Record<
    string,
    { present: number; late: number; absent: number; excused: number }
  > = {};
  for (const r of records) {
    if (!byGradeMap[r.grade])
      byGradeMap[r.grade] = { present: 0, late: 0, absent: 0, excused: 0 };
    if (r.status === "present") byGradeMap[r.grade]!.present++;
    else if (r.status === "late") byGradeMap[r.grade]!.late++;
    else if (r.status === "absent") byGradeMap[r.grade]!.absent++;
    else if (r.status === "excused") byGradeMap[r.grade]!.excused++;
  }

  const byGrade: AttendanceGradeSummary[] = Object.entries(gradeEnrollment)
    .map(([grade, total]) => {
      const g = byGradeMap[grade] ?? {
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
      };
      const marked = g.present + g.late + g.absent + g.excused;
      const rate =
        marked > 0 ? Math.round(((g.present + g.late) / marked) * 100) : 0;
      return { grade, total, marked, ...g, rate };
    })
    .sort((a, b) => a.grade.localeCompare(b.grade));

  // Last 14 days trend
  const recentDays: AttendanceOverview["recentDays"] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const { data: dayRecs } = await supabase
      .from("attendance_records")
      .select("status")
      .eq("date", dayStr)
      .eq("session", "full_day");

    const recs = (dayRecs ?? []) as { status: string }[];
    const total = recs.length;
    const attend = recs.filter(
      (r) => r.status === "present" || r.status === "late",
    ).length;
    recentDays.push({
      date: dayStr,
      rate: total > 0 ? Math.round((attend / total) * 100) : 0,
      marked: total,
    });
  }

  const totalMarked = records.length;
  const presentRate =
    totalMarked > 0 ? Math.round(((present + late) / totalMarked) * 100) : 0;

  return {
    date,
    totalStudents: students.length,
    totalMarked,
    present,
    late,
    absent,
    excused,
    presentRate,
    byGrade,
    recentDays,
  };
}

// ── Governance dashboard stats ────────────────────────────────────────────────

export async function fetchGovernanceStats(): Promise<GovernanceStats> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  const [announcRes, eventsRes, invRes, paymentsRes, attendRes] =
    await Promise.all([
      supabase
        .from("announcements")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("school_events")
        .select("id", { count: "exact", head: true })
        .gte("start_date", today),
      supabase.from("inventory_items").select("quantity, minimum_stock"),
      supabase
        .from("fee_payments")
        .select("amount_due, amount_paid, status")
        .eq("academic_year", 2026),
      supabase
        .from("attendance_records")
        .select("status")
        .eq("date", today)
        .eq("session", "full_day"),
    ]);

  const inventory = (invRes.data ?? []) as {
    quantity: number;
    minimum_stock: number;
  }[];
  const payments = (paymentsRes.data ?? []) as {
    amount_due: number;
    amount_paid: number;
    status: string;
  }[];
  const attend = (attendRes.data ?? []) as { status: string }[];

  const lowStockItems = inventory.filter(
    (i) => i.quantity <= i.minimum_stock,
  ).length;
  const overduePayments = payments.filter((p) =>
    ["pending", "partial", "overdue"].includes(p.status),
  ).length;
  const collectedThisTerm = payments.reduce(
    (s, p) => s + (p.amount_paid ?? 0),
    0,
  );
  const outstandingFees = payments
    .filter((p) => ["pending", "partial", "overdue"].includes(p.status))
    .reduce((s, p) => s + Math.max(0, p.amount_due - p.amount_paid), 0);

  const presentToday = attend.filter(
    (a) => a.status === "present" || a.status === "late",
  ).length;
  const absentToday = attend.filter((a) => a.status === "absent").length;
  const totalMarked = attend.length;
  const attendanceRate =
    totalMarked > 0 ? Math.round((presentToday / totalMarked) * 100) : 0;

  return {
    totalAnnouncements: announcRes.count ?? 0,
    upcomingEvents: eventsRes.count ?? 0,
    lowStockItems,
    overduePayments,
    collectedThisTerm,
    outstandingFees,
    presentToday,
    absentToday,
    attendanceRate,
  };
}
