// app/api/reports/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, Document } from "@react-pdf/renderer";
import React from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ReportCardPage } from "@/lib/pdf/ReportCardDocument";
import { getLogoPublicUrl, getActiveTermYear } from "@/lib/utils/settings";
import { getStudentPhotoUrl } from "@/lib/utils/photo-utils";

// ── Local row types ───────────────────────────────────────────────────────────

type BulkStudent = {
  id: string;
  full_name: string;
  readable_id: string | null;
  upi_number: string | null;
  gender: string | null;
  date_of_birth: string;
  current_grade: string;
  photo_url: string | null;
};

type BulkAssess = {
  student_id: string;
  subject_name: string;
  strand_id: string;
  score: string;
  teacher_remarks: string | null;
};

type BulkAtt = {
  student_id: string;
  status: string;
};

type BulkRC = {
  student_id: string;
  class_teacher_remarks: string | null;
  conduct_grade: string | null;
  effort_grade: string | null;
  generated_by: string | null;
};

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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
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
      .single<{ role: string }>();
    if (!profile || !["admin", "superadmin", "teacher"].includes(profile.role))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = (await req.json()) as {
      grade?: string;
      term?: number;
      academic_year?: number;
    };
    const grade = body.grade ?? "";
    const term = Number(body.term);
    const { academicYear: defaultYear } = await getActiveTermYear();
    const academicYear = Number(body.academic_year ?? defaultYear);

    if (!grade || ![1, 2, 3].includes(term))
      return NextResponse.json(
        { error: "Invalid grade or term" },
        { status: 400 },
      );

    // Teachers must be the class teacher for the requested grade
    if (profile.role === "teacher") {
      const { data: assignment } = await supabaseAdmin
        .from("class_teacher_assignments")
        .select("id")
        .eq("teacher_id", user.id)
        .eq("grade", grade)
        .eq("academic_year", academicYear)
        .maybeSingle();
      if (!assignment)
        return NextResponse.json(
          { error: "Not your assigned grade" },
          { status: 403 },
        );
    }

    // ── Fetch all data in parallel ────────────────────────────────────────────
    const [studentsRes, assessRes, attRes, rcRes, settingsRes] =
      await Promise.all([
        supabaseAdmin
          .from("students")
          .select(
            "id, full_name, readable_id, upi_number, gender, date_of_birth, current_grade, photo_url",
          )
          .eq("current_grade", grade)
          .eq("status", "active")
          .order("full_name"),

        supabaseAdmin
          .from("assessments")
          .select("student_id, subject_name, strand_id, score, teacher_remarks")
          .eq("term", term)
          .eq("academic_year", academicYear)
          .not("score", "is", null),

        supabaseAdmin.from("attendance").select("student_id, status"),

        supabaseAdmin
          .from("report_cards")
          .select(
            "student_id, class_teacher_remarks, conduct_grade, effort_grade, generated_by",
          )
          .eq("term", term)
          .eq("academic_year", academicYear),

        supabaseAdmin
          .from("school_settings")
          .select("school_name, school_email, school_phone, logo_url")
          .limit(1)
          .maybeSingle(),
      ]);

    const students = (studentsRes.data ?? []) as unknown as BulkStudent[];
    const assessments = (assessRes.data ?? []) as unknown as BulkAssess[];
    const attRows = (attRes.data ?? []) as unknown as BulkAtt[];
    const reportCards = (rcRes.data ?? []) as unknown as BulkRC[];
    const settings = settingsRes.data;

    if (students.length === 0)
      return NextResponse.json(
        { error: "No active students in this grade" },
        { status: 404 },
      );

    // ── Class teacher name — look up from assignments first ───────────────────
    let classTeacherName = "Class Teacher";
    {
      const { data: ctAssign } = await supabaseAdmin
        .from("class_teacher_assignments")
        .select("teacher_id")
        .eq("grade", grade)
        .eq("academic_year", academicYear)
        .maybeSingle();
      if (ctAssign?.teacher_id) {
        const { data: ctTeacher } = await supabaseAdmin
          .from("teachers")
          .select("full_name")
          .eq("id", ctAssign.teacher_id)
          .maybeSingle<{ full_name: string }>();
        if (ctTeacher?.full_name) classTeacherName = ctTeacher.full_name;
      }
      // Fallback: first report card's generated_by
      if (classTeacherName === "Class Teacher") {
        const firstRc = reportCards[0];
        if (firstRc?.generated_by) {
          const { data: t } = await supabaseAdmin
            .from("teachers")
            .select("full_name")
            .eq("id", firstRc.generated_by)
            .maybeSingle<{ full_name: string }>();
          if (t?.full_name) classTeacherName = t.full_name;
        }
      }
    }

    const schoolProps = {
      name: settings?.school_name ?? "Kibali Academy",
      email: settings?.school_email ?? "",
      phone: settings?.school_phone ?? "",
      logoUrl: settings?.logo_url
        ? (getLogoPublicUrl(settings.logo_url) ?? undefined)
        : undefined,
    };

    // ── Build one ReportCardPage element per student ──────────────────────────
    const pages = students.map((student) => {
      const sa = attRows.filter((r) => r.student_id === student.id);
      const present = sa.filter((r) => r.status === "Present").length;
      const absent = sa.filter((r) => r.status === "Absent").length;
      const late = sa.filter((r) => r.status === "Late").length;

      const subjectMap = new Map<
        string,
        { strand_id: string; score: string; teacher_remarks: string | null }[]
      >();
      for (const a of assessments.filter((a) => a.student_id === student.id)) {
        const list = subjectMap.get(a.subject_name) ?? [];
        const idx = list.findIndex((x) => x.strand_id === a.strand_id);
        if (idx >= 0) list[idx] = a;
        else list.push(a);
        subjectMap.set(a.subject_name, list);
      }
      const subjects = Array.from(subjectMap.entries()).map(
        ([name, strands]) => ({
          name,
          strands,
          overallScore: computeOverall(strands.map((s) => s.score)),
        }),
      );

      const rc = reportCards.find((r) => r.student_id === student.id);

      return React.createElement(ReportCardPage, {
        key: student.id,
        student: {
          fullName: student.full_name,
          readableId: student.readable_id ?? undefined,
          upiNumber: student.upi_number ?? undefined,
          gender: student.gender ?? undefined,
          dateOfBirth: student.date_of_birth,
          grade: student.current_grade,
          photoUrl: getStudentPhotoUrl(student.photo_url) ?? undefined,
        },
        report: {
          term,
          academicYear,
          classTeacherName,
          classTeacherRemarks: rc?.class_teacher_remarks ?? undefined,
          conductGrade: rc?.conduct_grade ?? undefined,
          effortGrade: rc?.effort_grade ?? undefined,
        },
        subjects,
        attendance: { present, absent, late, total: sa.length },
        school: schoolProps,
      });
    });

    // Create the document with the array of pages as children
    const doc = React.createElement(
      Document,
      {
        title: `${grade} — Term ${term} ${academicYear} Report Cards`,
        author: schoolProps.name,
      },
      pages,
    );

    // Cast the document to satisfy renderToBuffer's strict type requirements
    const pdfBuffer = await renderToBuffer(doc as React.ReactElement<any>);

    const filename = `${grade.replace(/\s+/g, "_")}_Term${term}_${academicYear}_Reports.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[reports/generate]", err);
    return NextResponse.json(
      { error: "Bulk PDF generation failed" },
      { status: 500 },
    );
  }
}
