// lib/data/jss-final-aggregator.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildKESSCEResult } from "@/lib/utils/kessce-logic";
import type {
  DbAssessmentRow,
  DbStudentRow,
  DbJSSPathwayRow,
  IKESSCEResult,
} from "@/types/knec";

/** Build the full KESSCE package for one student */
export async function getGrade9KnecPackage(
  studentId: string,
  g9Year: number = 2026,
): Promise<IKESSCEResult | null> {
  const supabase = await createSupabaseServerClient();
  const years = [g9Year - 2, g9Year - 1, g9Year];

  const [studentRes, assessmentsRes, pathwayRes] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, full_name, upi_number, assessment_number, gender, current_grade, readable_id",
      )
      .eq("id", studentId)
      .single(),
    supabase
      .from("assessments")
      .select("*")
      .eq("student_id", studentId)
      .in("academic_year", years)
      .eq("is_final_sba", true),
    supabase
      .from("jss_pathways")
      .select("*")
      .eq("student_id", studentId)
      .maybeSingle(),
  ]);

  if (studentRes.error || !studentRes.data) return null;
  return buildKESSCEResult(
    studentRes.data as DbStudentRow,
    assessmentsRes.data as DbAssessmentRow[],
    pathwayRes.data as DbJSSPathwayRow,
    g9Year,
  );
}

/** Aggregate KESSCE data for all Grade 9 students */
export async function getKESSCEClassData(
  grade: string = "Grade 9 / JSS 3",
  g9Year: number = 2026,
): Promise<IKESSCEResult[]> {
  const supabase = await createSupabaseServerClient();
  const years = [g9Year - 2, g9Year - 1, g9Year];

  const [studentsRes, assessmentsRes, pathwaysRes] = await Promise.all([
    supabase
      .from("students")
      .select(
        "id, full_name, upi_number, assessment_number, gender, current_grade, readable_id",
      )
      .eq("current_grade", grade)
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("assessments")
      .select("*")
      .in("academic_year", years)
      .eq("is_final_sba", true),
    supabase.from("jss_pathways").select("*"),
  ]);

  const students = (studentsRes.data ?? []) as DbStudentRow[];
  const assessments = (assessmentsRes.data ?? []) as DbAssessmentRow[];
  const pathways = (pathwaysRes.data ?? []) as DbJSSPathwayRow[];

  const pathwayByStudent = new Map<string, DbJSSPathwayRow>();
  for (const p of pathways) pathwayByStudent.set(p.student_id, p);

  return students.map((student) => {
    const studentAssessments = assessments.filter(
      (a) => a.student_id === student.id,
    );
    const pathwayRow = pathwayByStudent.get(student.id) ?? null;
    return buildKESSCEResult(student, studentAssessments, pathwayRow, g9Year);
  });
}
