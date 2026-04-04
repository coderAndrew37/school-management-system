// app/api/report-pdf/route.ts
// GET /api/report-pdf?studentId=xxx&term=1&year=2026
//
// Returns a PDF as application/pdf stream.
// Auth: parent of the student | class teacher for the grade | admin/superadmin
// Parents only receive published reports; teachers/admins can preview drafts.

import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ReportCardDocument } from "@/lib/pdf/ReportCardDocument";
import { getActiveTermYear, getLogoPublicUrl } from "@/lib/utils/settings";
import { getStudentPhotoUrl } from "@/lib/utils/photo-utils";

// ── Score helper ──────────────────────────────────────────────────────────────

const SCORE_N: Record<string, number> = { EE: 4, ME: 3, AE: 2, BE: 1 };

function computeOverall(scores: string[]): string {
  if (scores.length === 0) return "ME";
  const avg = scores.reduce((s, x) => s + (SCORE_N[x] ?? 2), 0) / scores.length;
  if (avg >= 3.5) return "EE";
  if (avg >= 2.5) return "ME";
  if (avg >= 1.5) return "AE";
  return "BE";
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const studentId = searchParams.get("studentId");
  const termStr = searchParams.get("term");
  // Fall back to school_settings active year if not specified
  const { academicYear: defaultYear } = await getActiveTermYear();
  const yearStr = searchParams.get("year") ?? String(defaultYear);

  if (!studentId || !termStr)
    return NextResponse.json(
      { error: "Missing studentId or term" },
      { status: 400 },
    );

  const term = parseInt(termStr, 10);
  const academicYear = parseInt(yearStr, 10);

  if (![1, 2, 3].includes(term))
    return NextResponse.json(
      { error: "term must be 1, 2 or 3" },
      { status: 400 },
    );

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  // ── Fetch data (parallel) ─────────────────────────────────────────────────
  const [studentRes, reportRes, assessRes, attRes, settingsRes] =
    await Promise.all([
      supabaseAdmin
        .from("students")
        .select(
          "id, full_name, readable_id, upi_number, gender, date_of_birth, current_grade, photo_url",
        )
        .eq("id", studentId)
        .single(),

      supabaseAdmin
        .from("report_cards")
        .select(
          "class_teacher_remarks, conduct_grade, effort_grade, status, generated_by",
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
        .eq("student_id", studentId)
        .eq("academic_year", academicYear)
        .eq("term", term),

      supabaseAdmin
        .from("school_settings")
        .select("school_name, school_email, school_phone, logo_url")
        .limit(1)
        .maybeSingle(),
    ]);

  if (studentRes.error || !studentRes.data)
    return NextResponse.json({ error: "Student not found" }, { status: 404 });

  // Parents only see published reports
  if (profile.role === "parent" && reportRes.data?.status !== "published")
    return NextResponse.json(
      { error: "Report not yet published" },
      { status: 403 },
    );

  // Class teacher name — look up from assignments first (works even before a draft is saved),
  // fall back to the teacher who generated the report if that's set
  let classTeacherName = "Class Teacher";
  {
    // 1. Try class_teacher_assignments for this student's grade
    const { data: studentForCT } = await supabaseAdmin
      .from("students")
      .select("current_grade")
      .eq("id", studentId)
      .maybeSingle();
    if (studentForCT?.current_grade) {
      const { data: ctAssign } = await supabaseAdmin
        .from("class_teacher_assignments")
        .select("teacher_id")
        .eq("grade", studentForCT.current_grade)
        .eq("academic_year", academicYear)
        .maybeSingle();
      if (ctAssign?.teacher_id) {
        const { data: ctTeacher } = await supabaseAdmin
          .from("teachers")
          .select("full_name")
          .eq("id", ctAssign.teacher_id)
          .maybeSingle();
        if (ctTeacher?.full_name) classTeacherName = ctTeacher.full_name;
      }
    }
    // 2. If still "Class Teacher", try report_cards.generated_by as fallback
    if (classTeacherName === "Class Teacher" && reportRes.data?.generated_by) {
      const { data: t } = await supabaseAdmin
        .from("teachers")
        .select("full_name")
        .eq("id", reportRes.data.generated_by)
        .maybeSingle();
      if (t?.full_name) classTeacherName = t.full_name;
    }
  }

  // Aggregate attendance
  const attRows = (attRes.data ?? []) as { status: string }[];
  const present = attRows.filter((r) => r.status === "Present").length;
  const absent = attRows.filter((r) => r.status === "Absent").length;
  const late = attRows.filter((r) => r.status === "Late").length;

  // Group assessments by subject
  const subjectMap = new Map<
    string,
    { strand_id: string; score: string; teacher_remarks: string | null }[]
  >();
  type AssessRow = {
    student_id: string;
    subject_name: string;
    strand_id: string;
    score: string;
    teacher_remarks: string | null;
    term: number;
  };
  for (const row of (assessRes.data ?? []) as unknown as AssessRow[]) {
    const list = subjectMap.get(row.subject_name) ?? [];
    // Latest score wins (deduplicate by strand_id)
    const idx = list.findIndex((x) => x.strand_id === row.strand_id);
    if (idx >= 0) list[idx] = row;
    else list.push(row);
    subjectMap.set(row.subject_name, list);
  }

  const subjects = Array.from(subjectMap.entries()).map(([name, strands]) => ({
    name,
    strands,
    overallScore: computeOverall(strands.map((s) => s.score)),
  }));

  const settings = settingsRes.data;

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const docProps = {
    student: {
      fullName: studentRes.data.full_name,
      readableId: studentRes.data.readable_id ?? undefined,
      upiNumber: studentRes.data.upi_number ?? undefined,
      gender: studentRes.data.gender ?? undefined,
      dateOfBirth: studentRes.data.date_of_birth,
      grade: studentRes.data.current_grade,
      photoUrl: getStudentPhotoUrl(studentRes.data.photo_url) ?? undefined,
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
    attendance: { present, absent, late, total: attRows.length },
    school: {
      name: settings?.school_name ?? "Kibali Academy",
      email: settings?.school_email ?? "",
      phone: settings?.school_phone ?? "",
      logoUrl: settings?.logo_url
        ? (getLogoPublicUrl(settings.logo_url) ?? undefined)
        : undefined,
    },
  };

  try {
    const buffer = Buffer.from(
      await renderToBuffer(ReportCardDocument(docProps)),
    );
    const filename = `${studentRes.data.full_name.replace(/\s+/g, "_")}_Term${term}_${academicYear}.pdf`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[report-pdf]", err);
    return NextResponse.json(
      { error: "PDF generation failed" },
      { status: 500 },
    );
  }
}
