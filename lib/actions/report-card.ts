"use server";

// lib/actions/report-card.ts

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/actions/auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

interface SaveArgs {
  studentId: string;
  academicYear: number;
  classTeacherId: string;
  classTeacherRemarks: string;
  conductGrade: string | null;
  effortGrade: string | null;
  existingId: string | null;
}

export async function saveReportCardAction(
  args: SaveArgs,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const session = await getSession();
  if (!session || session.profile.role !== "teacher") {
    return { success: false, error: "Unauthorized" };
  }

  const {
    studentId,
    academicYear,
    classTeacherId,
    classTeacherRemarks,
    conductGrade,
    effortGrade,
    existingId,
  } = args;

  // Verify this teacher is the class teacher for this student's grade
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("current_grade")
    .eq("id", studentId)
    .single();

  if (!student) return { success: false, error: "Student not found" };

  const { data: assignment } = await supabaseAdmin
    .from("class_teacher_assignments")
    .select("id")
    .eq("teacher_id", classTeacherId)
    .eq("grade", student.current_grade)
    .eq("academic_year", academicYear)
    .maybeSingle();

  if (!assignment)
    return {
      success: false,
      error: "Not authorised as class teacher for this grade",
    };

  const payload = {
    student_id: studentId,
    academic_year: academicYear,
    generated_by: classTeacherId,
    class_teacher_remarks: classTeacherRemarks || null,
    conduct_grade: conductGrade || null,
    effort_grade: effortGrade || null,
    status: "draft" as const,
  };

  let id: string;

  if (existingId) {
    const { data, error } = await supabaseAdmin
      .from("report_cards")
      .update(payload)
      .eq("id", existingId)
      .select("id")
      .single();

    if (error) {
      console.error("[saveReportCard update]", error.message);
      return { success: false, error: error.message };
    }
    id = data.id;
  } else {
    // Need a term — use current term heuristic
    const month = new Date().getMonth() + 1; // 1-12
    const term = month <= 4 ? 1 : month <= 8 ? 2 : 3;

    const { data, error } = await supabaseAdmin
      .from("report_cards")
      .upsert(
        { ...payload, term },
        { onConflict: "student_id,term,academic_year" },
      )
      .select("id")
      .single();

    if (error) {
      console.error("[saveReportCard upsert]", error.message);
      return { success: false, error: error.message };
    }
    id = data.id;
  }

  revalidatePath("/teacher/class/reports");
  return { success: true, id };
}

export async function publishReportCardAction(
  studentId: string,
  academicYear: number,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session || session.profile.role !== "teacher") {
    return { success: false, error: "Unauthorized" };
  }

  // Find the report card for this student
  const month = new Date().getMonth() + 1;
  const term = month <= 4 ? 1 : month <= 8 ? 2 : 3;

  const { data: rc, error: rcErr } = await supabaseAdmin
    .from("report_cards")
    .select("id, status")
    .eq("student_id", studentId)
    .eq("academic_year", academicYear)
    .eq("term", term)
    .maybeSingle();

  if (rcErr) return { success: false, error: rcErr.message };

  if (!rc) {
    // Auto-create a minimal published record if teacher forgot to save first
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("current_grade")
      .eq("id", studentId)
      .single();

    if (!student) return { success: false, error: "Student not found" };

    const teacherId = session.profile.teacher_id;
    if (!teacherId)
      return { success: false, error: "Teacher profile not linked" };

    const { error } = await supabaseAdmin.from("report_cards").insert({
      student_id: studentId,
      term,
      academic_year: academicYear,
      generated_by: teacherId,
      status: "published",
      published_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
  } else {
    const { error } = await supabaseAdmin
      .from("report_cards")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", rc.id);

    if (error) return { success: false, error: error.message };
  }

  // TODO: trigger parent notification (Phase 3)
  // await sendParentNotification(studentId, "report_ready", { term, academicYear });

  revalidatePath("/teacher/class/reports");
  revalidatePath("/parent");

  return { success: true };
}
