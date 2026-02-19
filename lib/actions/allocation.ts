"use server";

import { createServerClient } from "@/lib/supabase/client";
import { DAYS, PERIODS } from "@/lib/types/allocation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

  revalidatePath("/allocation");
  revalidatePath("/timetable");
  return { success: true, message: "Subject allocated successfully." };
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

  revalidatePath("/allocation");
  revalidatePath("/timetable");
  return { success: true, message: "Allocation removed." };
}

// ── 3. Generate timetable ─────────────────────────────────────────────────────
//
// Algorithm (constraint-based greedy):
//  1. Load all allocations for the given year
//  2. Group by grade
//  3. For each grade, spread each allocation's weekly_lessons across Mon–Fri
//     avoiding:
//       - same grade, same slot (no double-booking)
//       - same teacher, same slot (teacher conflict)
//  4. Wipe existing slots for the year, then bulk-insert new ones

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

  const allocations: RawAllocation[] = allocationsRaw;

  if (allocations.length === 0) {
    return {
      success: false,
      message:
        "No allocations found. Please allocate subjects to teachers first.",
    };
  }

  const DAYS_COUNT = DAYS.length; // 5
  const PERIODS_PER_DAY = PERIODS.length; // 8

  // Track occupied slots: grade+day+period and teacher+day+period
  const gradeSlots = new Set<string>(); // `${grade}-${day}-${period}`
  const teacherSlots = new Set<string>(); // `${teacherId}-${day}-${period}`

  type SlotInsert = {
    allocation_id: string;
    grade: string;
    day_of_week: number;
    period: number;
    academic_year: number;
  };

  const slotsToInsert: SlotInsert[] = [];

  // Group allocations by grade so we can interleave subjects nicely
  const byGrade = new Map<string, RawAllocation[]>();
  for (const alloc of allocations) {
    const existing = byGrade.get(alloc.grade) ?? [];
    existing.push(alloc);
    byGrade.set(alloc.grade, existing);
  }

  for (const [grade, gradeAllocs] of byGrade) {
    // Build a flat list of lessons needed: repeat allocationId by weekly_lessons
    const lessonQueue: RawAllocation[] = [];
    for (const alloc of gradeAllocs) {
      const count = alloc.subjects?.weekly_lessons ?? 5;
      for (let i = 0; i < count; i++) lessonQueue.push(alloc);
    }

    // Shuffle lessons for a natural spread (deterministic seed from grade name)
    let seed = grade.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return Math.abs(seed) / 0x7fffffff;
    };
    lessonQueue.sort(() => rng() - 0.5);

    // Assign each lesson to the next free slot
    let lessonIdx = 0;
    outer: for (let day = 1; day <= DAYS_COUNT; day++) {
      for (let period = 1; period <= PERIODS_PER_DAY; period++) {
        if (lessonIdx >= lessonQueue.length) break outer;

        const alloc = lessonQueue[lessonIdx]!;
        const gradeKey = `${grade}-${day}-${period}`;
        const teacherKey = `${alloc.teacher_id}-${day}-${period}`;

        if (gradeSlots.has(gradeKey) || teacherSlots.has(teacherKey)) {
          continue; // slot taken, try next
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

  // Wipe existing timetable for the year
  const { error: deleteError } = await supabase
    .from("timetable_slots")
    .delete()
    .eq("academic_year", academicYear);

  if (deleteError) {
    console.error("generateTimetable delete error:", deleteError);
    return { success: false, message: "Failed to clear existing timetable." };
  }

  // Bulk insert
  const { error: insertError } = await supabase
    .from("timetable_slots")
    .insert(slotsToInsert);

  if (insertError) {
    console.error("generateTimetable insert error:", insertError);
    return { success: false, message: "Failed to save generated timetable." };
  }

  revalidatePath("/timetable");
  return {
    success: true,
    message: `Timetable generated! ${slotsToInsert.length} lesson slots scheduled across ${byGrade.size} grades.`,
  };
}
