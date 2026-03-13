"use server";

// lib/actions/teacher.ts

import { notifyAbsence } from "@/lib/notifications/parent-notify";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseAdmin } from "../supabase/admin";

export interface ActionResult {
  success: boolean;
  message: string;
}

// ── Diary / Homework ──────────────────────────────────────────────────────────

const diarySchema = z.object({
  studentId: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(200),
  content: z.string().optional(),
  homework: z.boolean().default(false),
  dueDate: z.string().optional().nullable(),
  isCompleted: z.boolean().default(false),
});

export async function createDiaryEntryAction(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const raw = {
    studentId: formData.get("studentId"),
    title: formData.get("title"),
    content: formData.get("content") ?? undefined,
    homework: formData.get("homework") === "true",
    dueDate: formData.get("dueDate") || null,
    isCompleted: false,
  };

  const parsed = diarySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { error } = await supabase.from("student_diary").insert({
    student_id: parsed.data.studentId,
    title: parsed.data.title,
    content: parsed.data.content ?? null,
    homework: parsed.data.homework,
    due_date: parsed.data.dueDate ?? null,
    is_completed: parsed.data.isCompleted,
  });

  if (error) {
    console.error("[createDiaryEntryAction]", error.message);
    return { success: false, message: "Failed to save diary entry." };
  }

  revalidatePath("/teacher");
  revalidatePath("/parent");
  return { success: true, message: "Diary entry saved." };
}

export async function updateDiaryEntryAction(
  entryId: string,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const { error } = await supabase
    .from("student_diary")
    .update({
      title: formData.get("title") as string,
      content: (formData.get("content") as string) ?? null,
      homework: formData.get("homework") === "true",
      due_date: (formData.get("dueDate") as string) || null,
      is_completed: formData.get("isCompleted") === "true",
    })
    .eq("id", entryId);

  if (error)
    return { success: false, message: "Failed to update diary entry." };

  revalidatePath("/teacher");
  revalidatePath("/parent");
  return { success: true, message: "Entry updated." };
}

// ── Attendance ────────────────────────────────────────────────────────────────
// Status enum matches the DB check constraint:
//   "Present" | "Absent" | "Late" | "Excused"

const ATTENDANCE_STATUSES = ["Present", "Absent", "Late", "Excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

const attendanceSchema = z.object({
  studentId: z.string().uuid(),
  status: z.enum(ATTENDANCE_STATUSES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  remarks: z.string().optional().nullable(),
});

export async function recordAttendanceAction(
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const raw = {
    studentId: formData.get("studentId"),
    status: formData.get("status"),
    date: formData.get("date"),
    remarks: formData.get("remarks") || null,
  };

  const parsed = attendanceSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { error } = await supabase.from("attendance").upsert(
    {
      student_id: parsed.data.studentId,
      status: parsed.data.status,
      date: parsed.data.date,
      remarks: parsed.data.remarks ?? null,
    },
    { onConflict: "student_id,date" },
  );

  if (error) {
    console.error("[recordAttendanceAction]", error.message);
    return { success: false, message: "Failed to record attendance." };
  }

  // Phase 3: notify parents when student is absent (non-blocking)
  if (parsed.data.status === "Absent") {
    fireAbsenceNotification(parsed.data.studentId, parsed.data.date);
  }

  revalidatePath("/teacher");
  revalidatePath("/parent");
  return { success: true, message: "Attendance recorded." };
}

/**
 * Bulk attendance — save a whole class at once.
 * Called by the class teacher's bulk register (/teacher/class/attendance).
 */
export async function bulkRecordAttendanceAction(
  records: {
    studentId: string;
    status: AttendanceStatus;
    date: string;
    remarks?: string;
  }[],
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const rows = records.map((r) => ({
    student_id: r.studentId,
    status: r.status,
    date: r.date,
    remarks: r.remarks ?? null,
  }));

  const { error } = await supabase
    .from("attendance")
    .upsert(rows, { onConflict: "student_id,date" });

  if (error) {
    console.error("[bulkRecordAttendanceAction]", error.message);
    return {
      success: false,
      message: `Failed to save attendance: ${error.message}`,
    };
  }

  // Phase 3: fire absence notifications for all absent students (non-blocking)
  const absentIds = records
    .filter((r) => r.status === "Absent")
    .map((r) => ({ studentId: r.studentId, date: r.date }));

  if (absentIds.length > 0) {
    // Don't await — fire and forget so the teacher's UI doesn't wait
    Promise.allSettled(
      absentIds.map(({ studentId, date }) =>
        fireAbsenceNotification(studentId, date),
      ),
    ).catch((err) => console.error("[bulkRecordAttendanceAction notify]", err));
  }

  revalidatePath("/teacher");
  revalidatePath("/parent");
  return {
    success: true,
    message: `Attendance saved for ${records.length} students.`,
  };
}

// ── Internal: fetch student info then fire notification ───────────────────────

async function fireAbsenceNotification(studentId: string, date: string) {
  try {
    const { data: student, error } = await supabaseAdmin
      .from("students")
      .select("full_name, current_grade")
      .eq("id", studentId)
      .single();

    if (error || !student) {
      console.error("[fireAbsenceNotification] student not found:", studentId);
      return;
    }

    await notifyAbsence({
      studentId,
      studentName: student.full_name,
      grade: student.current_grade,
      date,
    });
  } catch (err) {
    // Never let notification failure surface to the teacher
    console.error("[fireAbsenceNotification]", err);
  }
}

// ── Assessment / Narrative ────────────────────────────────────────────────────

const assessmentSchema = z.object({
  studentId: z.string().uuid(),
  teacherId: z.string().uuid(),
  subjectName: z.string().min(1),
  strandId: z.string().min(1),
  score: z.enum(["EE", "ME", "AE", "BE"]).nullable(),
  teacherRemarks: z.string().optional().nullable(),
  term: z.number().int().min(1).max(3),
  academicYear: z.number().int().default(2026),
  evidenceUrl: z.string().url().optional().nullable(),
});

export async function saveAssessmentAction(
  data: z.infer<typeof assessmentSchema>,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const parsed = assessmentSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { error } = await supabase.from("assessments").upsert(
    {
      student_id: parsed.data.studentId,
      teacher_id: parsed.data.teacherId,
      subject_name: parsed.data.subjectName,
      strand_id: parsed.data.strandId,
      score: parsed.data.score,
      teacher_remarks: parsed.data.teacherRemarks ?? null,
      term: parsed.data.term,
      academic_year: parsed.data.academicYear,
      evidence_url: parsed.data.evidenceUrl ?? null,
    },
    { onConflict: "student_id,subject_name,strand_id,term,academic_year" },
  );

  if (error) {
    console.error("[saveAssessmentAction]", error.message);
    return { success: false, message: "Failed to save assessment." };
  }

  revalidatePath("/teacher/assess");
  revalidatePath("/parent");
  return { success: true, message: "Assessment saved." };
}

// ── JSS Pathway ───────────────────────────────────────────────────────────────

const pathwaySchema = z.object({
  studentId: z.string().uuid(),
  recommendedPathway: z.string().min(1),
  strengths: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  teacherNotes: z.string().optional().nullable(),
  pathwayCluster: z.string().optional().nullable(),
  strongSubjects: z.array(z.string()).optional(),
  careerInterests: z.array(z.string()).optional(),
  learningStyle: z.string().optional().nullable(),
});

export async function saveJssPathwayAction(
  data: z.infer<typeof pathwaySchema>,
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const parsed = pathwaySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { error } = await supabase.from("jss_pathways").upsert(
    {
      student_id: parsed.data.studentId,
      recommended_pathway: parsed.data.recommendedPathway,
      strengths: parsed.data.strengths ?? [],
      interests: parsed.data.interests ?? [],
      teacher_notes: parsed.data.teacherNotes ?? null,
      pathway_cluster: parsed.data.pathwayCluster ?? null,
      strong_subjects: parsed.data.strongSubjects ?? [],
      career_interests: parsed.data.careerInterests ?? [],
      learning_style: parsed.data.learningStyle ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id" },
  );

  if (error) {
    console.error("[saveJssPathwayAction]", error.message);
    return { success: false, message: "Failed to save pathway." };
  }

  revalidatePath("/teacher");
  revalidatePath("/parent");
  return { success: true, message: "Pathway saved successfully." };
}

// ── In-app notification to parent ────────────────────────────────────────────
// Writes to the `notifications` table (in-app bell).
// For SMS/email use notifyAbsence / notifyReportReady from parent-notify.ts.

export async function sendParentNotificationAction(
  studentId: string,
  title: string,
  message: string,
  type: "info" | "warning" | "success" = "info",
): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated." };

  const { error } = await supabase.from("notifications").insert({
    student_id: studentId,
    title,
    body: message,
    type,
    is_read: false,
  });

  if (error) {
    console.error("[sendParentNotificationAction]", error.message);
    return { success: false, message: "Failed to send notification." };
  }

  revalidatePath("/parent");
  return { success: true, message: "Notification sent to parent." };
}
