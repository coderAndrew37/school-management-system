"use server";

// app/api/report-pdf/route.ts
// Phase 4: Report card PDF generator
// GET /api/report-pdf?studentId=xxx&term=1&year=2026

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportCardDocument } from "@/lib/pdf/ReportCardDocument";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const studentId = searchParams.get("studentId");
  const termStr = searchParams.get("term");
  const yearStr = searchParams.get("year") ?? "2026";

  if (!studentId || !termStr) {
    return NextResponse.json(
      { error: "Missing studentId or term" },
      { status: 400 },
    );
  }

  const term = parseInt(termStr, 10);
  const academicYear = parseInt(yearStr, 10);

  if (![1, 2, 3].includes(term)) {
    return NextResponse.json(
      { error: "term must be 1, 2, or 3" },
      { status: 400 },
    );
  }

  // ── Auth check ─────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow if: parent of this student OR teacher assigned to this grade
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });

  if (profile.role === "parent") {
    const { data: link } = await supabaseAdmin
      .from("student_parents")
      .select("id")
      .eq("student_id", studentId)
      .eq("parent_id", user.id)
      .maybeSingle();
    if (!link)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (profile.role === "teacher") {
    // Teacher must be class teacher for this grade
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("current_grade")
      .eq("id", studentId)
      .single();
    if (!student)
      return NextResponse.json({ error: "Student not found" }, { status: 404 });

    const { data: assignment } = await supabaseAdmin
      .from("class_teacher_assignments")
      .select("id")
      .eq("teacher_id", user.id)
      .eq("grade", student.current_grade)
      .eq("academic_year", academicYear)
      .maybeSingle();
    if (!assignment)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } else if (!["admin", "superadmin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Fetch all data ─────────────────────────────────────────────────────────
  const [studentRes, reportRes, assessRes, attRes] = await Promise.all([
    supabaseAdmin
      .from("students")
      .select(
        "id, full_name, readable_id, upi_number, gender, date_of_birth, current_grade",
      )
      .eq("id", studentId)
      .single(),

    supabaseAdmin
      .from("report_cards")
      .select(
        "class_teacher_remarks, conduct_grade, effort_grade, status, published_at, generated_by",
      )
      .eq("student_id", studentId)
      .eq("term", term)
      .eq("academic_year", academicYear)
      .maybeSingle(),

    supabaseAdmin
      .from("assessments")
      .select("subject_name, strand_id, score, teacher_remarks")
      .eq("student_id", studentId)
      .eq("term", term)
      .eq("academic_year", academicYear)
      .not("score", "is", null)
      .order("subject_name"),

    supabaseAdmin
      .from("attendance")
      .select("status")
      .eq("student_id", studentId),
  ]);

  if (studentRes.error || !studentRes.data) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  // Only allow PDF for published reports (parents) — teachers can preview drafts
  if (profile.role === "parent" && reportRes.data?.status !== "published") {
    return NextResponse.json(
      { error: "Report not yet published" },
      { status: 403 },
    );
  }

  // Fetch class teacher name
  let classTeacherName = "Class Teacher";
  if (reportRes.data?.generated_by) {
    const { data: teacher } = await supabaseAdmin
      .from("teachers")
      .select("full_name")
      .eq("id", reportRes.data.generated_by)
      .maybeSingle();
    if (teacher) classTeacherName = teacher.full_name;
  }

  // Aggregate attendance
  const attRows = (attRes.data ?? []) as { status: string }[];
  const present = attRows.filter((r) => r.status === "Present").length;
  const absent = attRows.filter((r) => r.status === "Absent").length;
  const late = attRows.filter((r) => r.status === "Late").length;
  const total = attRows.length;

  // Group scores by subject
  const subjectMap = new Map<
    string,
    { strand_id: string; score: string; teacher_remarks: string | null }[]
  >();
  for (const row of (assessRes.data ?? []) as any[]) {
    const list = subjectMap.get(row.subject_name) ?? [];
    list.push({
      strand_id: row.strand_id,
      score: row.score,
      teacher_remarks: row.teacher_remarks,
    });
    subjectMap.set(row.subject_name, list);
  }

  const subjects = Array.from(subjectMap.entries()).map(([name, strands]) => ({
    name,
    strands,
    overallScore: computeOverall(strands.map((s) => s.score)),
  }));

  // ── Build PDF ──────────────────────────────────────────────────────────────
  const docProps = {
    student: {
      fullName: studentRes.data.full_name,
      readableId: studentRes.data.readable_id ?? undefined,
      upiNumber: studentRes.data.upi_number ?? undefined,
      gender: studentRes.data.gender ?? undefined,
      dateOfBirth: studentRes.data.date_of_birth,
      grade: studentRes.data.current_grade,
    },
    report: {
      term,
      academicYear,
      classTeacherName,
      classTeacherRemarks: reportRes.data?.class_teacher_remarks ?? undefined,
      conductGrade: reportRes.data?.conduct_grade ?? undefined,
      effortGrade: reportRes.data?.effort_grade ?? undefined,
    },
    subjects,
    attendance: { present, absent, late, total },
  };

  try {
    const buffer = await renderToBuffer(ReportCardDocument(docProps));

    const safeFilename = `${studentRes.data.full_name.replace(/\s+/g, "_")}_Term${term}_${academicYear}.pdf`;

    // FIX: Cast Buffer to any or wrap in a new Response to ensure compatibility with Next.js/Web API
    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${safeFilename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[report-pdf] renderToBuffer failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed" },
      { status: 500 },
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCORE_NUMERIC: Record<string, number> = { EE: 4, ME: 3, AE: 2, BE: 1 };

function computeOverall(scores: string[]): string {
  if (scores.length === 0) return "ME";
  const avg =
    scores.reduce((sum, s) => sum + (SCORE_NUMERIC[s] ?? 2), 0) / scores.length;
  if (avg >= 3.5) return "EE";
  if (avg >= 2.5) return "ME";
  if (avg >= 1.5) return "AE";
  return "BE";
}
