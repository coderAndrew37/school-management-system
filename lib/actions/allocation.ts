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
  classId: z.string().uuid("Invalid class selection"), // Scalable: Uses Class UUID
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
  const supabase = createServerClient();

  // --- Fetch info for email (Joining classes to get the grade label) ---
  const [teacherRes, subjectRes, classRes] = await Promise.all([
    supabase
      .from("teachers")
      .select("full_name, email")
      .eq("id", teacherId)
      .single(),
    supabase.from("subjects").select("name").eq("id", subjectId).single(),
    supabase.from("classes").select("grade, stream").eq("id", classId).single(),
  ]);

  const { error } = await supabase.from("teacher_subject_allocations").insert({
    teacher_id: teacherId,
    subject_id: subjectId,
    class_id: classId,
    academic_year: academicYear,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        message:
          "This subject is already allocated for this specific class and year.",
      };
    }
    console.error("createAllocation error:", error);
    return {
      success: false,
      message: "Failed to save allocation. Please try again.",
    };
  }

  // Send Notification
  if (teacherRes.data && subjectRes.data && classRes.data) {
    try {
      await sendAllocationEmail({
        teacherEmail: teacherRes.data.email,
        teacherName: teacherRes.data.full_name,
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

  // Fetch allocations joined with class labels and subject rules
  const { data: allocationsRaw, error: fetchError } = await supabase
    .from("teacher_subject_allocations")
    .select(
      `
      id, 
      teacher_id, 
      class_id, 
      academic_year,
      classes ( grade, stream ),
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
    gradeLabel: string; // Used for identifying unique class groups
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
    // Use Grade + Stream as the unique identifier for the logic
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

    // Seed based on grade name for consistency
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

        // Conflict check: ensure neither the grade nor teacher is already busy
        if (gradeSlots.has(gradeKey) || teacherSlots.has(teacherKey)) {
          continue;
        }

        gradeSlots.add(gradeKey);
        teacherSlots.add(teacherKey);
        slotsToInsert.push({
          allocation_id: alloc.id,
          grade: grade, // Still stored as label in timetable_slots
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
