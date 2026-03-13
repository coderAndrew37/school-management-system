"use server";

import { createServerClient } from "@/lib/supabase/client";
import { DAYS, PERIODS } from "@/lib/types/allocation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sendAllocationEmail } from "../mail";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const allocationSchema = z.object({
  teacherId: z.string().uuid("Invalid teacher"),
  subjectId: z.string().uuid("Invalid subject"),
  grade: z.string().min(1, "Grade is required"),
  academicYear: z.coerce.number().int().min(2024).max(2040).default(2026),
});

// ── Action result type ────────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  message: string;
}

// ── 1. Create allocation ──────────────────────────────────────────────────────

export async function createAllocationAction(
  formData: FormData,
): Promise<ActionResult> {
  const raw = {
    teacherId: formData.get("teacherId"),
    subjectId: formData.get("subjectId"),
    grade: formData.get("grade"),
    academicYear: formData.get("academicYear") ?? 2026,
  };

  const parsed = allocationSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { teacherId, subjectId, grade, academicYear } = parsed.data;
  const supabase = createServerClient();

  // --- Fetch teacher and subject info for the email ---
  const [{ data: info }, { data: sub }] = await Promise.all([
    supabase
      .from("teachers")
      .select("full_name, email")
      .eq("id", teacherId)
      .single(),
    supabase.from("subjects").select("name").eq("id", subjectId).single(),
  ]);

  const { error } = await supabase.from("teacher_subject_allocations").insert({
    teacher_id: teacherId,
    subject_id: subjectId,
    grade,
    academic_year: academicYear,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        message:
          "This subject is already allocated to another teacher for this grade and year.",
      };
    }
    console.error("createAllocation error:", error);
    return {
      success: false,
      message: "Failed to save allocation. Please try again.",
    };
  }

  if (info && sub) {
    try {
      await sendAllocationEmail({
        teacherEmail: info.email,
        teacherName: info.full_name,
        subjectName: sub.name,
        grade: grade,
      });
    } catch (mailError) {
      console.error(
        "Email failed to send, but allocation was saved:",
        mailError,
      );
    }
  }

  revalidatePath("/admin/allocation");
  revalidatePath("/admin/timetable");
  return { success: true, message: "Subject allocated and teacher notified." };
}

// ── 2. Delete allocation ──────────────────────────────────────────────────────

export async function deleteAllocationAction(
  allocationId: string,
): Promise<ActionResult> {
  if (!allocationId)
    return { success: false, message: "No allocation ID provided." };

  const supabase = createServerClient();
  const { error } = await supabase
    .from("teacher_subject_allocations")
    .delete()
    .eq("id", allocationId);

  if (error) {
    console.error("deleteAllocation error:", error);
    return { success: false, message: "Failed to remove allocation." };
  }

  revalidatePath("/admin/allocation");
  revalidatePath("/admin/timetable");
  return { success: true, message: "Allocation removed." };
}

// ── 3. Generate timetable ─────────────────────────────────────────────────────

export async function generateTimetableAction(
  academicYear = 2026,
): Promise<ActionResult> {
  const supabase = createServerClient();

  // Fetch all allocations with subject weekly_lessons
  const { data: allocationsRaw, error: fetchError } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `
      id, teacher_id, subject_id, grade, academic_year,
      subjects ( weekly_lessons )
    `,
    )
    .eq("academic_year", academicYear);

  if (fetchError || !allocationsRaw) {
    console.error("generateTimetable fetch error:", fetchError);
    return { success: false, message: "Could not load allocations." };
  }

  type RawAllocation = {
    id: string;
    teacher_id: string;
    grade: string;
    subjects: { weekly_lessons: number } | null;
  };

  /**
   * FIX: Supabase returns joined data as an array 'subjects: [{ weekly_lessons }]'.
   * We map it here to ensure it matches the RawAllocation object structure.
   */
  const allocations: RawAllocation[] = (allocationsRaw as any[]).map((row) => ({
    id: row.id,
    teacher_id: row.teacher_id,
    grade: row.grade,
    subjects: Array.isArray(row.subjects) ? row.subjects[0] : row.subjects,
  }));

  if (allocations.length === 0) {
    return {
      success: false,
      message:
        "No allocations found. Please allocate subjects to teachers first.",
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
  };

  const slotsToInsert: SlotInsert[] = [];

  const byGrade = new Map<string, RawAllocation[]>();
  for (const alloc of allocations) {
    const existing = byGrade.get(alloc.grade) ?? [];
    existing.push(alloc);
    byGrade.set(alloc.grade, existing);
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
          grade,
          day_of_week: day,
          period,
          academic_year: academicYear,
        });
        lessonIdx++;
      }
    }
  }

  const { error: deleteError } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("academic_year", academicYear);

  if (deleteError) {
    console.error("generateTimetable delete error:", deleteError);
    return { success: false, message: "Failed to clear existing timetable." };
  }

  const { error: insertError } = await supabase
    .from("timetable_slots")
    .insert(slotsToInsert);

  if (insertError) {
    console.error("generateTimetable insert error:", insertError);
    return { success: false, message: "Failed to save generated timetable." };
  }

  revalidatePath("/admin/timetable");
  return {
    success: true,
    message: `Timetable generated! ${slotsToInsert.length} lesson slots scheduled across ${byGrade.size} grades.`,
  };
}
