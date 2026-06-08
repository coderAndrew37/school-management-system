"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/auth";
import { DAYS, PERIODS } from "@/lib/types/allocation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendAllocationEmail } from "../mail";

// ── 1. Zod schemas ───────────────────────────────────────────────────────────

const allocationSchema = z.object({
  teacherId: z.string().uuid("Invalid teacher"),
  subjectId: z.string().uuid("Invalid subject"),
  classId: z.string().uuid("Invalid class selection"),
  academicYear: z.coerce.number().int().min(2024).max(2040).default(2026),
});

// ── 2. Action result type ────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  message: string;
}

// Helper to assert granular management permissions
function hasAllocationPermission(profile: any): boolean {
  if (profile.is_super_admin || profile.is_dev) return true;
  const overrides = profile.allowed_permissions_override ?? [];
  return overrides.includes("manage_allocations");
}

// ── 3. Create allocation ──────────────────────────────────────────────────────

export async function createAllocationAction(
  formData: FormData,
): Promise<ActionResult> {
  try {
    const session = await getSession();
    if (!session?.profile) {
      return { success: false, message: "Unauthorised" };
    }

    // Enforce dynamic authorization constraints over rigid string mapping checks
    if (!hasAllocationPermission(session.profile)) {
      return { success: false, message: "Unauthorised: Insufficient structural management permissions." };
    }

    const { school_id } = session.profile;
    if (!school_id) {
      return { success: false, message: "Action failed: Missing structural school context linkages." };
    }

    const raw = {
      teacherId: formData.get("teacherId"),
      subjectId: formData.get("subjectId"),
      classId: formData.get("classId"),
      academicYear: formData.get("academicYear") ?? 2026,
    };

    const parsed = allocationSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      };
    }

    const { teacherId, subjectId, classId, academicYear } = parsed.data;
    const supabase = await createSupabaseServerClient();

    interface TeacherProfileJoin {
      id: string;
      profiles: {
        full_name: string;
        email?: string;
      } | {
        full_name: string;
        email?: string;
      }[] | null;
    }

    const [teacherRes, subjectRes, classRes] = await Promise.all([
      supabase
        .from("teachers")
        .select(`
          id,
          profiles (full_name, email)
        `)
        .eq("id", teacherId)
        .single(),
      supabase.from("subjects").select("name").eq("id", subjectId).single(),
      supabase.from("classes").select("grade, stream").eq("id", classId).eq("school_id", school_id).single(),
    ]);

    const { error } = await supabase.from("teacher_subject_allocations").insert({
      teacher_id: teacherId,
      subject_id: subjectId,
      class_id: classId,
      academic_year: academicYear,
      school_id: school_id, 
    });

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          message: "This subject is already allocated for this specific class and year.",
        };
      }
      console.error("createAllocation error:", error);
      return {
        success: false,
        message: "Failed to save allocation. Please try again.",
      };
    }

    if (teacherRes.data && subjectRes.data && classRes.data) {
      try {
        const rawTeacher = teacherRes.data as unknown as TeacherProfileJoin;
        const teacherProfile = Array.isArray(rawTeacher.profiles)
          ? rawTeacher.profiles[0]
          : rawTeacher.profiles;

        await sendAllocationEmail({
          teacherEmail: teacherProfile?.email || "assigned-teacher@kibaliacademy.co.ke",
          teacherName: teacherProfile?.full_name || "Teacher",
          subjectName: subjectRes.data.name,
          grade: `${classRes.data.grade} (${classRes.data.stream})`,
        });
      } catch (mailError) {
        console.error("Email failed, but allocation saved:", mailError);
      }
    }

    revalidatePath("/admin/allocation");
    revalidatePath("/admin/timetable");
    return { success: true, message: "Subject allocated and teacher notified." };
  } catch (err) {
    console.error("[createAllocationAction] Fallback crash:", err);
    return { success: false, message: "An unexpected error occurred during creation routing." };
  }
}

// ── 4. Delete allocation ──────────────────────────────────────────────────────

export async function deleteAllocationAction(
  allocationId: string,
): Promise<ActionResult> {
  if (!allocationId) return { success: false, message: "No allocation ID provided." };

  const session = await getSession();
  if (!session?.profile) return { success: false, message: "Unauthorised" };

  if (!hasAllocationPermission(session.profile)) {
    return { success: false, message: "Unauthorised: Insufficient management privileges." };
  }

  const { school_id } = session.profile;
  if (!school_id) return { success: false, message: "Missing tenant workspace tracking context." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("teacher_subject_allocations")
    .delete()
    .eq("id", allocationId)
    .eq("school_id", school_id); 

  if (error) {
    console.error("deleteAllocation error:", error);
    return { success: false, message: "Failed to remove allocation." };
  }

  revalidatePath("/admin/allocation");
  revalidatePath("/admin/timetable");
  return { success: true, message: "Allocation removed." };
}

// ── 5. Generate timetable ─────────────────────────────────────────────────────

export async function generateTimetableAction(
  academicYear = 2026,
): Promise<ActionResult> {
  const session = await getSession();
  if (!session?.profile) return { success: false, message: "Unauthorised" };
  
  if (!hasAllocationPermission(session.profile)) {
    return { success: false, message: "Unauthorised: Insufficient management privileges." };
  }

  const { school_id } = session.profile;
  if (!school_id) return { success: false, message: "Unauthorised" };

  const supabase = await createSupabaseServerClient();

  const { data: allocationsRaw, error: fetchError } = await supabase
    .from("teacher_subject_allocations")
    .select(`
      id, 
      teacher_id, 
      class_id, 
      academic_year,
      classes ( grade, stream ),
      subjects ( weekly_lessons )
    `)
    .eq("academic_year", academicYear)
    .eq("school_id", school_id);

  if (fetchError || !allocationsRaw) {
    console.error("generateTimetable fetch error:", fetchError);
    return { success: false, message: "Could not load allocations." };
  }

  type RawAllocation = {
    id: string;
    teacher_id: string;
    gradeLabel: string;
    subjects: { weekly_lessons: number } | null;
  };

  type AllocationRow = {
    id: string;
    teacher_id: string;
    classes: { grade: string; stream: string };
    subjects: { weekly_lessons: number } | { weekly_lessons: number }[] | null;
  };

  const allocations: RawAllocation[] = (allocationsRaw as unknown as AllocationRow[]).map((row) => ({
    id: row.id,
    teacher_id: row.teacher_id,
    gradeLabel: `${row.classes.grade}-${row.classes.stream}`,
    subjects: Array.isArray(row.subjects) ? row.subjects[0] : row.subjects,
  }));

  if (allocations.length === 0) {
    return {
      success: false,
      message: "No allocations found. Please allocate subjects first.",
    };
  }

  const DAYS_COUNT = DAYS.length;
  const PERIODS_PER_DAY = PERIODS.length;

  const gradeSlots = new Set<string>();
  const teacherSlots = new Set<string>();

  type SlotInsert = {
    allocation_id: string;
    grade: string;
    day_of_week: number;
    period: number;
    academic_year: number;
    school_id: string;
  };

  const slotsToInsert: SlotInsert[] = [];

  const byGrade = new Map<string, RawAllocation[]>();
  for (const alloc of allocations) {
    const existing = byGrade.get(alloc.gradeLabel) ?? [];
    existing.push(alloc);
    byGrade.set(alloc.gradeLabel, existing);
  }

  for (const [grade, gradeAllocs] of byGrade) {
    const lessonQueue: RawAllocation[] = [];
    for (const alloc of gradeAllocs) {
      const count = alloc.subjects?.weekly_lessons ?? 5;
      for (let i = 0; i < count; i++) lessonQueue.push(alloc);
    }

    let seed = grade.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return Math.abs(seed) / 0x7fffffff;
    };
    lessonQueue.sort(() => rng() - 0.5);

    let lessonIdx = 0;
    outer: for (let day = 1; day <= DAYS_COUNT; day++) {
      for (let period = 1; period <= PERIODS_PER_DAY; period++) {
        if (lessonIdx >= lessonQueue.length) break outer;

        const alloc = lessonQueue[lessonIdx]!;
        const gradeKey = `${grade}-${day}-${period}`;
        const teacherKey = `${alloc.teacher_id}-${day}-${period}`;

        if (gradeSlots.has(gradeKey) || teacherSlots.has(teacherKey)) {
          continue;
        }

        gradeSlots.add(gradeKey);
        teacherSlots.add(teacherKey);
        slotsToInsert.push({
          allocation_id: alloc.id,
          grade: grade,
          day_of_week: day,
          period,
          academic_year: academicYear,
          school_id: school_id,
        });
        lessonIdx++;
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("academic_year", academicYear)
    .eq("school_id", school_id);

  if (deleteError) {
    return { success: false, message: "Failed to clear existing timetable." };
  }

  const { error: insertError } = await supabase
    .from("timetable_slots")
    .insert(slotsToInsert);

  if (insertError) {
    console.error("Timetable insert error:", insertError);
    return { success: false, message: "Failed to save timetable." };
  }

  revalidatePath("/admin/timetable");
  return {
    success: true,
    message: `Timetable generated! ${slotsToInsert.length} slots scheduled.`,
  };
}