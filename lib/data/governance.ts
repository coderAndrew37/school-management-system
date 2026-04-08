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
  AttendanceRecord,
} from "@/lib/types/governance";
import { Class } from "../types/allocation";

// ── Types for Internal Data Fetching ─────────────────────────────────────────

interface ClassWithCount {
  id: string;
  grade: string;
  stream: string;
  students: { count: number }[];
}

// ── Announcements ─────────────────────────────────────────────────────────────

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const supabase = await createSupabaseServerClient();

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

  const authorIds = [
    ...new Set(rows.map((r) => r.author_id).filter(Boolean)),
  ] as string[];

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
    // Aliasing class_id:current_grade for type safety
    .select("*, students(full_name, readable_id, class_id:current_grade)")
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
  // Fixed: Aliased current_grade to class_id to match StudentSummary interface
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, readable_id, class_id:current_grade")
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
  
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
  const startDateStr = fourteenDaysAgo.toISOString().slice(0, 10);

  const [recordsRes, classesRes, trendRes] = await Promise.all([
    supabase
      .from("attendance_records")
      .select("student_id, class_id, status")
      .eq("date", date)
      .eq("session", "full_day"),
    
    supabase
      .from("classes")
      .select(`
        id, 
        grade, 
        stream,
        students:students(count)
      `)
      .eq("academic_year", 2026),

    supabase
      .from("attendance_records")
      .select("date, status")
      .gte("date", startDateStr)
      .lte("date", date)
      .eq("session", "full_day"),
  ]);

  const records = (recordsRes.data ?? []) as Pick<AttendanceRecord, "student_id" | "class_id" | "status">[];
  const classRows = (classesRes.data ?? []) as unknown as ClassWithCount[];
  const trendData = (trendRes.data ?? []) as Pick<AttendanceRecord, "date" | "status">[];

  const present = records.filter((r) => r.status === "present").length;
  const late = records.filter((r) => r.status === "late").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const excused = records.filter((r) => r.status === "excused").length;
  const totalMarked = records.length;
  
  const totalStudents = classRows.reduce((acc, c) => acc + (c.students?.[0]?.count ?? 0), 0);
  const presentRate = totalMarked > 0 ? Math.round(((present + late) / totalMarked) * 100) : 0;

  const byClass: AttendanceGradeSummary[] = classRows.map((c) => {
    const classRecords = records.filter((r) => r.class_id === c.id);
    
    const stats = {
      present: classRecords.filter((r) => r.status === "present").length,
      late: classRecords.filter((r) => r.status === "late").length,
      absent: classRecords.filter((r) => r.status === "absent").length,
      excused: classRecords.filter((r) => r.status === "excused").length,
    };
    
    const cMarked = classRecords.length;
    const cTotal = c.students?.[0]?.count ?? 0;
    
    return {
      class_id: c.id,
      label: `${c.grade} ${c.stream}`, 
      total: cTotal,
      marked: cMarked,
      ...stats,
      rate: cMarked > 0 ? Math.round(((stats.present + stats.late) / cMarked) * 100) : 0,
    };
  }).sort((a, b) => a.label.localeCompare(b.label));

  const recentDays = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dayStr = d.toISOString().slice(0, 10);
    
    const dayRecs = trendData.filter((r) => r.date === dayStr);
    const dayTotal = dayRecs.length;
    const dayAttend = dayRecs.filter((r) => r.status === "present" || r.status === "late").length;

    return {
      date: dayStr,
      rate: dayTotal > 0 ? Math.round((dayAttend / dayTotal) * 100) : 0,
      marked: dayTotal,
    };
  });

  return {
    date,
    totalStudents,
    totalMarked,
    present,
    late,
    absent,
    excused,
    presentRate,
    byClass,
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

  const inventory = (invRes.data ?? []) as Pick<InventoryItem, "quantity" | "minimum_stock">[];
  const payments = (paymentsRes.data ?? []) as Pick<FeePayment, "amount_due" | "amount_paid" | "status">[];
  const attend = (attendRes.data ?? []) as Pick<AttendanceRecord, "status">[];

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
    .reduce((s, p) => s + Math.max(0, p.amount_due - (p.amount_paid ?? 0)), 0);

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

export async function fetchAllClasses(): Promise<Class[]> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("classes")
    .select("id, grade, stream")
    .order("grade", { ascending: true })
    .order("stream", { ascending: true });

  if (error) {
    console.error("[fetchAllClasses]", error.message);
    return [];
  }

  return (data ?? []) as Class[];
}