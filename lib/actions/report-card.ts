"use server";

// lib/actions/report-card.ts

import { getSession } from "@/lib/actions/auth";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "../supabase/admin";

interface SaveArgs {
  studentId: string;
  academicYear: number;
  classTeacherId: string;
  classTeacherRemarks: string;
  conductGrade: string | null;
  effortGrade: string | null;
  existingId: string | null;
}

// Helper to determine authorization level
async function checkReportCardAuth() {
  const session = await getSession();
  if (!session || !session.profile) {
    return { authorized: false, isPlatformAdmin: false, session: null };
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev || base_role === "admin";
  const authorized = isPlatformAdmin || base_role === "staff";

  return { authorized, isPlatformAdmin, session };
}

export async function saveReportCardAction(
  args: SaveArgs,
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const { authorized, isPlatformAdmin, session } = await checkReportCardAuth();
  if (!authorized || !session) {
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

  // Fetch student grade details
  const { data: student } = await supabaseAdmin
    .from("students")
    .select("current_grade")
    .eq("id", studentId)
    .single();

  if (!student) return { success: false, error: "Student not found" };

  // Skip assignment validations if handled by an administrator
  if (!isPlatformAdmin) {
    const { data: assignment } = await supabaseAdmin
      .from("class_teacher_assignments")
      .select("id")
      .eq("teacher_id", session.profile.id)
      .eq("grade", student.current_grade)
      .eq("academic_year", academicYear)
      .maybeSingle();

    if (!assignment) {
      return {
        success: false,
        error: "Not authorised as class teacher for this grade",
      };
    }
  }

  const payload = {
    student_id: studentId,
    academic_year: academicYear,
    generated_by: classTeacherId || session.profile.id,
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
    const month = new Date().getMonth() + 1;
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
  const { authorized, isPlatformAdmin, session } = await checkReportCardAuth();
  if (!authorized || !session) {
    return { success: false, error: "Unauthorized" };
  }

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
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("current_grade")
      .eq("id", studentId)
      .single();

    if (!student) return { success: false, error: "Student not found" };

    // Strict role evaluation to find optimal generated_by tracking ID
    let targetTeacherId = session.profile.id;

    if (!isPlatformAdmin) {
      const { data: assignment } = await supabaseAdmin
        .from("class_teacher_assignments")
        .select("id")
        .eq("teacher_id", session.profile.id)
        .eq("grade", student.current_grade)
        .eq("academic_year", academicYear)
        .maybeSingle();

      if (!assignment) {
        return { success: false, error: "Not authorized to publish for this grade." };
      }
    } else {
      // Admin bypass override: check who is assigned to this class to use their ID as standard fallback
      const { data: assignedCt } = await supabaseAdmin
        .from("class_teacher_assignments")
        .select("teacher_id")
        .eq("grade", student.current_grade)
        .eq("academic_year", academicYear)
        .maybeSingle();
        
      if (assignedCt?.teacher_id) {
        targetTeacherId = assignedCt.teacher_id;
      }
    }

    const { error } = await supabaseAdmin.from("report_cards").insert({
      student_id: studentId,
      term,
      academic_year: academicYear,
      generated_by: targetTeacherId,
      status: "published",
      published_at: new Date().toISOString(),
    });

    if (error) return { success: false, error: error.message };
  } else {
    // Validate teacher constraints for preexisting report cards before editing status
    if (!isPlatformAdmin) {
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("current_grade")
        .eq("id", studentId)
        .single();

      const { data: assignment } = await supabaseAdmin
        .from("class_teacher_assignments")
        .select("id")
        .eq("teacher_id", session.profile.id)
        .eq("grade", student?.current_grade ?? "")
        .eq("academic_year", academicYear)
        .maybeSingle();

      if (!assignment) {
        return { success: false, error: "Not authorized to modify this class report." };
      }
    }

    const { error } = await supabaseAdmin
      .from("report_cards")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", rc.id);

    if (error) return { success: false, error: error.message };
  }

  // Phase 3: notify parents (non-blocking thread)
  supabaseAdmin
    .from("students")
    .select("full_name, current_grade")
    .eq("id", studentId)
    .single()
    .then(({ data: student }) => {
      if (!student) return;
      import("@/lib/actions/parent-notify").then(
        ({ notifyReportReady }) =>
          notifyReportReady({
            studentId,
            studentName: student.full_name,
            grade: student.current_grade,
            term,
            academicYear,
          }),
      );
    });

  revalidatePath("/teacher/class/reports");
  revalidatePath("/parent");

  return { success: true };
}