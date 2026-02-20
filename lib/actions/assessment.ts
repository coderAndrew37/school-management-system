"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/actions/auth";
import {
  GRADE_LEVEL_MAP,
  NARRATIVE_CONTEXT,
  SCORE_LABELS,
} from "@/lib/types/assessment";
import type { CbcScore } from "@/lib/types/assessment";

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
// Receives a flat list of {studentId, subjectName, strandId, score} rows
// and upserts them using the unique constraint on
// (student_id, subject_name, strand_id, term, academic_year)

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

  // Validate each row
  const validated = rows.map((r) => rowSchema.safeParse(r));
  const invalid = validated.filter((v) => !v.success);
  if (invalid.length > 0) {
    return { success: false, message: "Some rows failed validation." };
  }

  // Only upsert rows where score is not null
  const upsertRows = validated
    .filter((v) => v.success && (v as any).data.score !== null)
    .map((v) => {
      const d = (v as any).data;
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

  // Delete rows that were explicitly set to null (cleared)
  const clearRows = validated
    .filter((v) => v.success && (v as any).data.score === null)
    .map((v) => (v as any).data);

  let savedCount = 0;

  if (upsertRows.length > 0) {
    const { error } = await supabase.from("assessments").upsert(upsertRows, {
      onConflict: "student_id,subject_name,strand_id,term,academic_year",
      ignoreDuplicates: false,
    });

    if (error) {
      console.error("[batchUpsertAssessments]", error);
      return { success: false, message: "Database error: " + error.message };
    }
    savedCount = upsertRows.length;
  }

  // Handle cleared scores (delete them)
  for (const r of clearRows) {
    await supabase.from("assessments").delete().match({
      student_id: r.studentId,
      subject_name: r.subjectName,
      strand_id: r.strandId,
      term: r.term,
      academic_year: r.academicYear,
    });
  }

  revalidatePath("/teacher/assess");
  return {
    success: true,
    message: `Saved ${savedCount} assessment${savedCount !== 1 ? "s" : ""}.`,
    savedCount,
  };
}

// ── 2. Generate AI narrative remark ──────────────────────────────────────────
// Given a student's assessment scores for a subject, asks Claude for
// a grade-appropriate narrative remark, then caches it in assessment_narratives

export async function generateNarrativeAction(
  fd: FormData,
): Promise<NarrativeResult> {
  await requireTeacher();
  const supabase = await createSupabaseServerClient();

  const studentId = fd.get("student_id") as string;
  const studentName = fd.get("student_name") as string;
  const subjectName = fd.get("subject_name") as string;
  const grade = fd.get("grade") as string;
  const term = parseInt(fd.get("term") as string, 10);
  const academicYear = parseInt(
    (fd.get("academic_year") as string) || "2026",
    10,
  );

  // Build a summary of the student's strand scores for this subject
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

  // Format scores for the prompt
  const scoreSummary = scores
    .map(
      (s) =>
        `- ${s.strand_id.replace(/-/g, " ")}: ${s.score} (${SCORE_LABELS[s.score]})`,
    )
    .join("\n");

  const level = GRADE_LEVEL_MAP[grade] ?? "upper_primary";
  const gradeContext = NARRATIVE_CONTEXT[level];

  const prompt = `${gradeContext}

Student: ${studentName}
Grade: ${grade}
Subject: ${subjectName}
Term: ${term}

Strand Performance:
${scoreSummary}

Write a narrative remark for ${studentName}'s ${subjectName} performance this term. 
Do not include the student's name in the remark — it will be prefixed automatically.
Do not use bullet points or lists. Write in flowing prose.
Do not mention letter codes like EE/ME/AE/BE — describe performance naturally.
Respond with ONLY the narrative remark text, no preamble.`;

  // Call Claude API
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[generateNarrative] API error:", err);
      return { success: false, message: "AI service error. Please try again." };
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
    };

    const narrative = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();

    if (!narrative) {
      return { success: false, message: "No narrative returned." };
    }

    // Cache the narrative in the DB
    await supabase.from("assessment_narratives").upsert(
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

    revalidatePath("/teacher/assess");
    return { success: true, narrative };
  } catch (err) {
    console.error("[generateNarrative]", err);
    return { success: false, message: "Failed to generate narrative." };
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

  if (error) return { success: false, message: "Failed to save." };
  revalidatePath("/teacher/assess");
  return { success: true, narrative, message: "Saved." };
}
