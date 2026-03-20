"use server";

// lib/actions/timetable.ts
// Granular timetable mutations — swap, clear, assign.
// These allow the admin to edit the timetable without regenerating everything.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/actions/auth";

export interface TimetableActionResult {
  success: boolean;
  message: string;
}

// ── Guard ─────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role))
    throw new Error("Forbidden");
}

// ── 1. Swap two slots ─────────────────────────────────────────────────────────
// Swaps the allocation_id between two timetable_slots.
// Used for drag-and-drop reordering.

export async function swapSlotsAction(
  slotAId: string,
  slotBId: string,
): Promise<TimetableActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  if (slotAId === slotBId)
    return { success: true, message: "Same slot — nothing to do." };

  // Fetch both slots
  const { data: slots, error: fetchErr } = await supabaseAdmin
    .from("timetable_slots")
    .select("id, allocation_id, grade, day_of_week, period, academic_year")
    .in("id", [slotAId, slotBId]);

  if (fetchErr || !slots || slots.length !== 2)
    return { success: false, message: "Could not load slots for swap." };

  const slotA = slots.find((s) => s.id === slotAId)!;
  const slotB = slots.find((s) => s.id === slotBId)!;

  // Teacher conflict check: if slot A's teacher already has a lesson at slot B's time
  // (and it's not this slot), we'd create a clash. But since we're SWAPPING,
  // slotA goes to slotB's position and vice versa — no new conflicts are created
  // as long as the grades are the same. Cross-grade swaps are not supported.
  if (slotA.grade !== slotB.grade)
    return {
      success: false,
      message: "Cannot swap slots across different grades.",
    };

  // Perform the swap in two updates
  const [{ error: errA }, { error: errB }] = await Promise.all([
    supabaseAdmin
      .from("timetable_slots")
      .update({ allocation_id: slotB.allocation_id })
      .eq("id", slotAId),
    supabaseAdmin
      .from("timetable_slots")
      .update({ allocation_id: slotA.allocation_id })
      .eq("id", slotBId),
  ]);

  if (errA || errB) {
    console.error("[swapSlots]", errA?.message, errB?.message);
    return { success: false, message: "Swap failed. Please try again." };
  }

  revalidatePath("/admin/timetable");
  return { success: true, message: "Slots swapped." };
}

// ── 2. Clear a slot ───────────────────────────────────────────────────────────
// Removes a specific timetable slot (deletes the row).

export async function clearSlotAction(
  slotId: string,
): Promise<TimetableActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  const { error } = await supabaseAdmin
    .from("timetable_slots")
    .delete()
    .eq("id", slotId);

  if (error) {
    console.error("[clearSlot]", error.message);
    return { success: false, message: "Failed to clear slot." };
  }

  revalidatePath("/admin/timetable");
  return { success: true, message: "Slot cleared." };
}

// ── 3. Assign allocation to an empty slot ─────────────────────────────────────
// Creates a new timetable_slots row for an empty cell.

export async function assignSlotAction(
  grade: string,
  dayOfWeek: number,
  period: number,
  academicYear: number,
  allocationId: string,
): Promise<TimetableActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  // Check the slot isn't already filled
  const { data: existing } = await supabaseAdmin
    .from("timetable_slots")
    .select("id")
    .eq("grade", grade)
    .eq("day_of_week", dayOfWeek)
    .eq("period", period)
    .eq("academic_year", academicYear)
    .maybeSingle();

  if (existing)
    return {
      success: false,
      message: "This slot already has a lesson. Remove it first.",
    };

  // Conflict check: does this teacher already teach at this time?
  // Fetch the teacherId for this allocation
  const { data: alloc } = await supabaseAdmin
    .from("teacher_subject_allocations")
    .select("teacher_id")
    .eq("id", allocationId)
    .single();

  if (alloc?.teacher_id) {
    // Find all allocations for this teacher
    const { data: teacherAllocs } = await supabaseAdmin
      .from("teacher_subject_allocations")
      .select("id")
      .eq("teacher_id", alloc.teacher_id);

    const teacherAllocIds = (teacherAllocs ?? []).map((a) => a.id);

    if (teacherAllocIds.length > 0) {
      const { data: clash } = await supabaseAdmin
        .from("timetable_slots")
        .select("id, grade")
        .in("allocation_id", teacherAllocIds)
        .eq("day_of_week", dayOfWeek)
        .eq("period", period)
        .eq("academic_year", academicYear)
        .maybeSingle();

      if (clash)
        return {
          success: false,
          message: `Teacher clash: this teacher already has a lesson at this time (${clash.grade}).`,
        };
    }
  }

  const { error } = await supabaseAdmin.from("timetable_slots").insert({
    grade,
    day_of_week: dayOfWeek,
    period,
    academic_year: academicYear,
    allocation_id: allocationId,
  });

  if (error) {
    console.error("[assignSlot]", error.message);
    return { success: false, message: "Failed to assign slot." };
  }

  revalidatePath("/admin/timetable");
  return { success: true, message: "Lesson assigned." };
}

// ── 4. Move slot (drag from filled to empty) ──────────────────────────────────
// Moves a lesson from one slot to another empty slot.

export async function moveSlotAction(
  sourceSlotId: string,
  targetGrade: string,
  targetDay: number,
  targetPeriod: number,
  academicYear: number,
): Promise<TimetableActionResult> {
  try {
    await requireAdmin();
  } catch {
    return { success: false, message: "Not authorised." };
  }

  // Fetch source
  const { data: source } = await supabaseAdmin
    .from("timetable_slots")
    .select("id, allocation_id, grade, day_of_week, period, academic_year")
    .eq("id", sourceSlotId)
    .single();

  if (!source) return { success: false, message: "Source slot not found." };
  if (source.grade !== targetGrade)
    return {
      success: false,
      message: "Cannot move lessons across different grades.",
    };

  // Check target is empty
  const { data: targetExists } = await supabaseAdmin
    .from("timetable_slots")
    .select("id")
    .eq("grade", targetGrade)
    .eq("day_of_week", targetDay)
    .eq("period", targetPeriod)
    .eq("academic_year", academicYear)
    .maybeSingle();

  if (targetExists)
    return {
      success: false,
      message: "Target slot is occupied. Use swap instead.",
    };

  // Conflict check for the target position
  const { data: alloc } = await supabaseAdmin
    .from("teacher_subject_allocations")
    .select("teacher_id")
    .eq("id", source.allocation_id)
    .single();

  if (alloc?.teacher_id) {
    const { data: teacherAllocs } = await supabaseAdmin
      .from("teacher_subject_allocations")
      .select("id")
      .eq("teacher_id", alloc.teacher_id);

    const ids = (teacherAllocs ?? []).map((a) => a.id);
    if (ids.length > 0) {
      const { data: clash } = await supabaseAdmin
        .from("timetable_slots")
        .select("id, grade")
        .in("allocation_id", ids)
        .eq("day_of_week", targetDay)
        .eq("period", targetPeriod)
        .eq("academic_year", academicYear)
        .neq("id", sourceSlotId)
        .maybeSingle();

      if (clash)
        return {
          success: false,
          message: `Teacher clash at target position (${clash.grade}).`,
        };
    }
  }

  // Update the slot position
  const { error } = await supabaseAdmin
    .from("timetable_slots")
    .update({ day_of_week: targetDay, period: targetPeriod })
    .eq("id", sourceSlotId);

  if (error) {
    console.error("[moveSlot]", error.message);
    return { success: false, message: "Move failed. Please try again." };
  }

  revalidatePath("/admin/timetable");
  return { success: true, message: "Lesson moved." };
}
