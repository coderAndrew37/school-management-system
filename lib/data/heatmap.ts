// lib/data/heatmap.ts
// Fetches grade × subject CBC score averages for the class performance heatmap.
// Uses supabaseAdmin (service role) since this is admin-only data.

import { supabaseAdmin } from "../supabase/admin";

const SCORE_NUMERIC: Record<string, number> = { EE: 4, ME: 3, AE: 2, BE: 1 };
const NUMERIC_TO_GRADE = (avg: number): "EE" | "ME" | "AE" | "BE" => {
  if (avg >= 3.5) return "EE";
  if (avg >= 2.5) return "ME";
  if (avg >= 1.5) return "AE";
  return "BE";
};

export type CbcScore = "EE" | "ME" | "AE" | "BE";

export interface HeatmapCell {
  grade: string;
  subject: string;
  avg: number; // 1.0 – 4.0
  cbcScore: CbcScore;
  count: number; // number of assessment records
  studentCount: number; // distinct students assessed
}

export interface HeatmapData {
  grades: string[]; // ordered list of grades present
  subjects: string[]; // ordered list of subjects present
  cells: HeatmapCell[];
  term: number;
  year: number;
}

export async function fetchHeatmapData(
  term: number,
  academicYear: number,
): Promise<HeatmapData> {
  // Pull all scored assessments for the term
  const { data, error } = await supabaseAdmin
    .from("assessments")
    .select("student_id, subject_name, score, students(current_grade)")
    .eq("term", term)
    .eq("academic_year", academicYear)
    .not("score", "is", null);

  if (error) {
    console.error("[fetchHeatmapData]", error.message);
    return { grades: [], subjects: [], cells: [], term, year: academicYear };
  }

  // Aggregate: grade × subject → list of numeric scores
  const map = new Map<string, { nums: number[]; students: Set<string> }>();

  for (const row of (data ?? []) as any[]) {
    const grade = row.students?.current_grade;
    const subject = row.subject_name as string;
    const score = row.score as string;
    if (!grade || !subject || !SCORE_NUMERIC[score]) continue;

    const key = `${grade}||${subject}`;
    if (!map.has(key)) map.set(key, { nums: [], students: new Set() });
    const entry = map.get(key)!;
    entry.nums.push(SCORE_NUMERIC[score]);
    entry.students.add(row.student_id as string);
  }

  const cells: HeatmapCell[] = [];
  const gradeSet = new Set<string>();
  const subjectSet = new Set<string>();

  for (const [key, { nums, students }] of map.entries()) {
    const [grade, subject] = key.split("||") as [string, string];
    const avg = nums.reduce((s, n) => s + n, 0) / nums.length;
    gradeSet.add(grade);
    subjectSet.add(subject);
    cells.push({
      grade,
      subject,
      avg,
      cbcScore: NUMERIC_TO_GRADE(avg),
      count: nums.length,
      studentCount: students.size,
    });
  }

  // Sort grades in curriculum order, subjects alphabetically
  const GRADE_ORDER = [
    "PP1",
    "PP2",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
    "Grade 7 / JSS 1",
    "Grade 8 / JSS 2",
    "Grade 9 / JSS 3",
  ];

  const grades = GRADE_ORDER.filter((g) => gradeSet.has(g));
  const subjects = Array.from(subjectSet).sort();

  return { grades, subjects, cells, term, year: academicYear };
}
