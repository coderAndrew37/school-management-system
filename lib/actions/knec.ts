// ============================================================
// lib/actions/knec.ts
// Server Actions for KNEC exam admin tasks
// ============================================================
"use server";

import { getSession } from "@/lib/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ManualOverrideInput } from "@/types/knec";
import { KPSEA_AREAS } from "@/types/knec";

// ── Save / upsert a manual historical SBA override ───────────────────────────

export interface SaveOverrideResult {
  success: boolean;
  message: string;
}

export async function saveHistoricalOverrideAction(
  input: ManualOverrideInput,
): Promise<SaveOverrideResult> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") {
    return { success: false, message: "Unauthorised" };
  }

  // Validate percentage
  if (input.avgPercentage < 0 || input.avgPercentage > 100) {
    return { success: false, message: "Percentage must be between 0 and 100" };
  }

  // Validate KPSEA area
  if (!KPSEA_AREAS.includes(input.knecArea as (typeof KPSEA_AREAS)[number])) {
    return { success: false, message: `Unknown KPSEA area: ${input.knecArea}` };
  }

  // Validate year
  if (
    input.academicYear < 2020 ||
    input.academicYear > new Date().getFullYear()
  ) {
    return { success: false, message: "Invalid academic year" };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("historical_sba_overrides").upsert(
    {
      student_id: input.studentId,
      academic_year: input.academicYear,
      knec_area: input.knecArea,
      avg_percentage: input.avgPercentage,
      source_school: input.sourceSchool || null,
      notes: input.notes || null,
      entered_by: session.user.id,
    },
    { onConflict: "student_id,academic_year,knec_area" },
  );

  if (error) {
    console.error("[saveHistoricalOverride]", error.message);
    return {
      success: false,
      message: "Failed to save override. Please try again.",
    };
  }

  return { success: true, message: "Historical SBA data saved successfully." };
}

// ── Save assessment_number for a Grade 6 student ─────────────────────────────

export interface SaveAssessmentNumberResult {
  success: boolean;
  message: string;
}

export async function saveAssessmentNumberAction(
  studentId: string,
  assessmentNumber: string,
): Promise<SaveAssessmentNumberResult> {
  const session = await getSession();
  if (!session || session.profile.role !== "admin") {
    return { success: false, message: "Unauthorised" };
  }

  const trimmed = assessmentNumber.trim();
  if (!trimmed) {
    return { success: false, message: "Assessment number cannot be empty" };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("students")
    .update({ assessment_number: trimmed })
    .eq("id", studentId);

  if (error) {
    if (error.code === "23505") {
      return {
        success: false,
        message:
          "That assessment number is already assigned to another student.",
      };
    }
    console.error("[saveAssessmentNumber]", error.message);
    return { success: false, message: "Failed to save. Please try again." };
  }

  return { success: true, message: "Assessment number saved." };
}
