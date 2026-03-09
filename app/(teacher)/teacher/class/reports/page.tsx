// app/teacher/class/reports/page.tsx
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { fetchMyClassTeacherAssignment } from "@/lib/actions/class-teacher";
import { ClassReportsClient } from "./ClassReportsClient";
import { SubjectScore, CbcScore, StudentReport } from "./types";

export const metadata = { title: "Report Cards | Kibali Teacher" };
export const revalidate = 0;

const ACADEMIC_YEAR = 2026;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export default async function ClassReportsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const assignment = await fetchMyClassTeacherAssignment();
  if (!assignment?.isClassTeacher || !assignment.grade) redirect("/teacher");

  const grade = assignment.grade; // narrowed to string

  // ── Students ───────────────────────────────────────────────────────────────
  const { data: rawStudents } = await supabaseAdmin
    .from("students")
    .select("id, full_name, readable_id, gender, date_of_birth, current_grade")
    .eq("current_grade", grade)
    .order("full_name");

  const students = (rawStudents ?? []) as {
    id: string;
    full_name: string;
    readable_id: string | null;
    gender: "Male" | "Female" | null;
    date_of_birth: string;
    current_grade: string;
  }[];

  const studentIds = students.map((s) => s.id);

  if (studentIds.length === 0) {
    return (
      <ClassReportsClient
        students={[]}
        grade={grade}
        academicYear={ACADEMIC_YEAR}
        classTeacherId={user.id}
      />
    );
  }

  // ── Assessments ────────────────────────────────────────────────────────────
  const { data: assessmentRows } = await supabaseAdmin
    .from("assessments")
    .select("student_id, subject_name, strand_id, score, teacher_remarks, term")
    .in("student_id", studentIds)
    .eq("academic_year", ACADEMIC_YEAR)
    .not("score", "is", null)
    .order("subject_name")
    .order("term");

  // ── Attendance ─────────────────────────────────────────────────────────────
  const { data: attendanceRows } = await supabaseAdmin
    .from("attendance")
    .select("student_id, status")
    .in("student_id", studentIds);

  // ── Existing report cards ──────────────────────────────────────────────────
  const { data: reportCards } = await supabaseAdmin
    .from("report_cards")
    .select(
      "id, student_id, term, class_teacher_remarks, conduct_grade, effort_grade, status",
    )
    .in("student_id", studentIds)
    .eq("academic_year", ACADEMIC_YEAR);

  // ── Aggregate scores — latest per (subject, strand) ────────────────────────
  const scoresByStudent = new Map<string, SubjectScore[]>();
  for (const r of (assessmentRows ?? []) as any[]) {
    if (!r.score) continue;
    const list = scoresByStudent.get(r.student_id) ?? [];
    const existingIdx = list.findIndex(
      (x) => x.subject_name === r.subject_name && x.strand_id === r.strand_id,
    );
    const entry: SubjectScore = {
      subject_name: r.subject_name,
      strand_id: r.strand_id,
      score: r.score as CbcScore,
      teacher_remarks: r.teacher_remarks ?? null,
      term: r.term,
    };
    if (existingIdx >= 0) list[existingIdx] = entry;
    else list.push(entry);
    scoresByStudent.set(r.student_id, list);
  }

  const attMap = new Map<
    string,
    { present: number; absent: number; late: number }
  >();
  for (const r of (attendanceRows ?? []) as {
    student_id: string;
    status: string;
  }[]) {
    const cur = attMap.get(r.student_id) ?? { present: 0, absent: 0, late: 0 };
    if (r.status === "Present") cur.present++;
    else if (r.status === "Absent") cur.absent++;
    else if (r.status === "Late") cur.late++;
    attMap.set(r.student_id, cur);
  }

  // Latest report card per student
  const rcMap = new Map<string, any>();
  for (const rc of (reportCards ?? []) as any[]) {
    rcMap.set(rc.student_id, rc);
  }

  const enriched: StudentReport[] = students.map((s) => {
    const att = attMap.get(s.id) ?? { present: 0, absent: 0, late: 0 };
    const total = att.present + att.absent + att.late;
    const rate =
      total > 0 ? Math.round(((att.present + att.late) / total) * 100) : 0;
    const rc = rcMap.get(s.id) ?? null;

    return {
      id: s.id,
      full_name: s.full_name,
      readable_id: s.readable_id ?? null,
      gender: s.gender ?? null,
      date_of_birth: s.date_of_birth ?? "",
      present: att.present,
      absent: att.absent,
      late: att.late,
      total_days: total,
      attendance_rate: rate,
      scores: scoresByStudent.get(s.id) ?? [],
      report_card_id: rc?.id ?? null,
      class_teacher_remarks: rc?.class_teacher_remarks ?? null,
      conduct_grade: rc?.conduct_grade ?? null,
      effort_grade: rc?.effort_grade ?? null,
      status: rc?.status ?? null,
    };
  });

  return (
    <ClassReportsClient
      students={enriched}
      grade={grade}
      academicYear={ACADEMIC_YEAR}
      classTeacherId={user.id}
    />
  );
}
