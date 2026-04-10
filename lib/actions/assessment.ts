"use server";

import { getSession } from "@/lib/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CbcScore } from "@/lib/types/assessment";
import {
  NARRATIVE_CONTEXT,
  resolveGradeLevel,
  SCORE_LABELS,
} from "@/lib/types/assessment";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AssessmentActionResult {
  success: boolean;
  message: string;
  savedCount?: number;
}

export interface NarrativeResult {
  success: boolean;
  narrative?: string;
  message: string;
}

interface AnthropicResponse {
  content: Array<{
    text: string;
    type: string;
  }>;
  id: string;
  model: string;
  role: string;
}

// ── Guard: teachers only ──────────────────────────────────────────────────────

async function requireTeacher(): Promise<{
  teacherId: string;
  userId: string;
}> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  if (session.profile.role !== "teacher" && session.profile.role !== "admin") {
    throw new Error("Forbidden");
  }
  return {
    teacherId: session.profile.teacher_id ?? "",
    userId: session.user.id,
  };
}

// ── 1. Batch upsert assessments ───────────────────────────────────────────────

const rowSchema = z.object({
  studentId: z.string().uuid(),
  subjectName: z.string().min(1),
  strandId: z.string().min(1),
  score: z.enum(["EE", "ME", "AE", "BE"]).nullable(),
  term: z.number().int().min(1).max(3),
  academicYear: z.number().int(),
});

export async function batchUpsertAssessmentsAction(
  rows: {
    studentId: string;
    subjectName: string;
    strandId: string;
    score: CbcScore | null;
    term: number;
    academicYear: number;
  }[],
): Promise<AssessmentActionResult> {
  const { teacherId } = await requireTeacher();
  const supabase = await createSupabaseServerClient();

  if (rows.length === 0) {
    return { success: true, message: "Nothing to save.", savedCount: 0 };
  }

  const validated = rows.map((r) => rowSchema.safeParse(r));
  const invalid = validated.filter((v) => !v.success);
  if (invalid.length > 0) {
    return { success: false, message: "Some rows failed validation." };
  }

  const upsertRows = validated
    .filter((v) => v.success && v.data.score !== null)
    .map((v) => {
      const d = v.data!;
      return {
        student_id: d.studentId,
        subject_name: d.subjectName,
        strand_id: d.strandId,
        score: d.score,
        term: d.term,
        academic_year: d.academicYear,
        teacher_id: teacherId || null,
      };
    });

  const clearRows = validated
    .filter((v) => v.success && v.data.score === null)
    .map((v) => v.data!);

  let savedCount = 0;

  try {
    if (upsertRows.length > 0) {
      const { error } = await supabase.from("assessments").upsert(upsertRows, {
        onConflict: "student_id,subject_name,strand_id,term,academic_year",
        ignoreDuplicates: false,
      });

      if (error) throw error;
      savedCount = upsertRows.length;
    }

    // Clear deleted/null scores
    for (const r of clearRows) {
      const { error: deleteError } = await supabase.from("assessments").delete().match({
        student_id: r.studentId,
        subject_name: r.subjectName,
        strand_id: r.strandId,
        term: r.term,
        academic_year: r.academicYear,
      });
      if (deleteError) console.error("[batchUpsert] Delete error:", deleteError.message);
    }

    revalidatePath("/teacher/assess");
    return {
      success: true,
      message: `Saved ${savedCount} assessment${savedCount !== 1 ? "s" : ""}.`,
      savedCount,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Database error";
    console.error("[batchUpsertAssessments]", msg);
    return { success: false, message: msg };
  }
}

// ── 2. Generate AI narrative remark ──────────────────────────────────────────

export async function generateNarrativeAction(
  fd: FormData,
): Promise<NarrativeResult> {
  await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const studentId = fd.get("student_id") as string;
  const studentName = fd.get("student_name") as string;
  const subjectName = fd.get("subject_name") as string;
  const gradeLabel = fd.get("grade") as string; 
  const term = parseInt(fd.get("term") as string, 10);
  const academicYear = parseInt(
    (fd.get("academic_year") as string) || "2026",
    10,
  );

  // Validate UUID input to prevent syntax errors
  if (!studentId || studentId === "undefined") {
    return { success: false, message: "Invalid student identifier." };
  }

  const { data: assessData } = await supabase
    .from("assessments")
    .select("strand_id, score")
    .eq("student_id", studentId)
    .eq("subject_name", subjectName)
    .eq("term", term)
    .eq("academic_year", academicYear);

  const scores = (assessData ?? []) as { strand_id: string; score: CbcScore }[];

  if (scores.length === 0) {
    return {
      success: false,
      message: "No scores recorded yet for this student in this subject.",
    };
  }

  const scoreSummary = scores
    .map(
      (s) =>
        `- ${s.strand_id.replace(/-/g, " ")}: ${s.score} (${SCORE_LABELS[s.score]})`,
    )
    .join("\n");

  const level = resolveGradeLevel(gradeLabel);
  const gradeContext = NARRATIVE_CONTEXT[level];

  const prompt = `${gradeContext}

Student: ${studentName}
Grade: ${gradeLabel}
Subject: ${subjectName}
Term: ${term}

Strand Performance:
${scoreSummary}

Write a narrative remark for ${studentName}'s ${subjectName} performance this term. 
Do not include the student's name in the remark — it will be prefixed automatically.
Do not use bullet points or lists. Write in flowing prose.
Do not mention letter codes like EE/ME/AE/BE — describe performance naturally.
Respond with ONLY the narrative remark text, no preamble.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20240620",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[generateNarrative] API error:", errText);
      return { success: false, message: "AI service error. Please try again." };
    }

    const data = (await response.json()) as AnthropicResponse;
    const narrative = data.content[0]?.text?.trim();

    if (!narrative) {
      return { success: false, message: "No narrative returned from AI." };
    }

    const { error: upsertError } = await supabase.from("assessment_narratives").upsert(
      {
        student_id: studentId,
        subject_name: subjectName,
        term,
        academic_year: academicYear,
        narrative,
        generated_at: new Date().toISOString(),
      },
      { onConflict: "student_id,subject_name,term,academic_year" },
    );

    if (upsertError) throw upsertError;

    revalidatePath("/teacher/assess");
    return {
      success: true,
      narrative,
      message: "Narrative generated successfully.",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to generate narrative";
    console.error("[generateNarrative]", msg);
    return { success: false, message: msg };
  }
}

// ── 3. Save a manually edited narrative ──────────────────────────────────────

export async function saveNarrativeAction(
  fd: FormData,
): Promise<NarrativeResult> {
  await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const studentId = fd.get("student_id") as string;
  const subjectName = fd.get("subject_name") as string;
  const term = parseInt(fd.get("term") as string, 10);
  const academicYear = parseInt(
    (fd.get("academic_year") as string) || "2026",
    10,
  );
  const narrative = ((fd.get("narrative") as string) ?? "").trim();

  if (!narrative)
    return { success: false, message: "Narrative cannot be empty." };
  
  if (!studentId || studentId === "undefined") {
    return { success: false, message: "Invalid student identifier." };
  }

  const { error } = await supabase.from("assessment_narratives").upsert(
    {
      student_id: studentId,
      subject_name: subjectName,
      term,
      academic_year: academicYear,
      narrative,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,subject_name,term,academic_year" },
  );

  if (error) {
    console.error("[saveNarrativeAction] Error:", error.message);
    return { success: false, message: "Failed to save record." };
  }

  revalidatePath("/teacher/assess");
  return { success: true, narrative, message: "Saved successfully." };
}

// ── 4. Data Fetching Utilities (Refactored for class_id) ──────────────────────

/**
 * Fetches all active students linked to a specific class UUID.
 * The system has been backfilled so class_id is now the source of truth.
 */
export async function fetchClassStudents(classId: string) {
  if (!classId || classId === "undefined") {
    console.warn("[fetchClassStudents] No valid Class ID provided.");
    return [];
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, admission_number, assessment_number, current_grade, class_id")
    .eq("class_id", classId)
    .eq("status", "active")
    .order("full_name");

  if (error) {
    console.error("[fetchClassStudents] Error:", error.message);
    return [];
  }

  return data;
}