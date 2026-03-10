// app/api/reports/generate/route.ts
// Bulk report card PDF generator
// POST /api/reports/generate
// Body: { grade: string, term: number, academic_year: number, mode: "bulk" | "single" }
//
// Replaces the Python subprocess approach.
// Uses the same @react-pdf/renderer + ReportCardDocument already used by /api/report-pdf

import { fetchStudentsForReports } from "@/lib/data/reports";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Document, renderToBuffer } from "@react-pdf/renderer";
import { NextRequest, NextResponse } from "next/server";
import React from "react";

// ── Auth guard helper ─────────────────────────────────────────────────────────

async function requireAdminOrClassTeacher(): Promise<
  | { ok: true; userId: string; role: string }
  | { ok: false; error: string; status: number }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized", status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) return { ok: false, error: "Profile not found", status: 403 };

  const allowed = ["admin", "superadmin", "teacher"];
  if (!allowed.includes(profile.role)) {
    return { ok: false, error: "Forbidden", status: 403 };
  }

  return { ok: true, userId: user.id, role: profile.role };
}

// ── Score helpers ─────────────────────────────────────────────────────────────

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

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Auth
    const auth = await requireAdminOrClassTeacher();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    // Parse body
    const body = (await req.json()) as {
      grade?: string;
      term: number;
      academic_year: number;
      mode?: "bulk" | "single";
    };

    const { grade, term, academic_year, mode = "bulk" } = body;

    if (!term || !academic_year) {
      return NextResponse.json(
        { error: "term and academic_year are required" },
        { status: 400 },
      );
    }

    if (![1, 2, 3].includes(term)) {
      return NextResponse.json(
        { error: "term must be 1, 2, or 3" },
        { status: 400 },
      );
    }

    // Fetch data
    const students = await fetchStudentsForReports(
      grade ?? null,
      term,
      academic_year,
    );

    if (students.length === 0) {
      return NextResponse.json(
        { error: "No students found for the given filters." },
        { status: 404 },
      );
    }

    // Build one PDF per student then merge into a single multi-page document.
    // @react-pdf/renderer renders a <Document> with multiple <Page> elements.
    // We compose all student pages inside one Document for a single download.

    const allPages = students.flatMap((student) => {
      // Group scores by subject
      const subjectMap = new Map<
        string,
        { strand_id: string; score: string; teacher_remarks: string | null }[]
      >();
      for (const a of student.assessments) {
        if (!a.score) continue;
        const list = subjectMap.get(a.subject_name) ?? [];
        list.push({
          strand_id: a.strand_id,
          score: a.score,
          teacher_remarks: a.teacher_remarks,
        });
        subjectMap.set(a.subject_name, list);
      }

      const subjects = Array.from(subjectMap.entries()).map(
        ([name, strands]) => ({
          name,
          strands,
          overallScore: computeOverall(strands.map((s) => s.score)),
        }),
      );

      // Construct props matching ReportCardDocument interface
      const props = {
        student: {
          fullName: student.full_name,
          readableId: student.readable_id ?? undefined,
          gender: student.gender ?? undefined,
          dateOfBirth: student.date_of_birth,
          grade: student.current_grade,
        },
        report: {
          term,
          academicYear: academic_year,
          classTeacherName: "Class Teacher",
          classTeacherRemarks: student.class_teacher_remarks ?? undefined,
          conductGrade: student.conduct_grade ?? undefined,
          effortGrade: student.effort_grade ?? undefined,
        },
        subjects,
        attendance: {
          present: student.attendance_present,
          absent: student.attendance_absent,
          late: student.attendance_late,
          total: student.attendance_total,
        },
      };

      // Extract the Page(s) from each student's Document
      // ReportCardDocument returns a <Document> with a single <Page> — we
      // re-render it as a standalone document per student in bulk mode.
      return props;
    });

    // For bulk: render all students into one document with multiple pages.
    // We do this by building a combined Document manually.
    const combinedBuffer = await renderToBuffer(
      React.createElement(
        Document,
        {
          title: `Kibali Academy Reports — Term ${term} ${academic_year}`,
          author: "Kibali Academy",
        },
        ...allPages.map((props) => {
          // We need the inner Page from ReportCardDocument.
          // Since ReportCardDocument returns a full Document, we use a
          // thin wrapper that calls the same builder but only grabs the Page.
          // In practice we import the Page-builder directly:
          return React.createElement(ReportCardPageOnly, props);
        }),
      ),
    );

    const gradeSlug =
      grade && grade !== "all" ? grade.replace(/[\s/]/g, "_") : "All_Grades";

    const filename = `Kibali_Reports_Term${term}_${academic_year}_${gradeSlug}.pdf`;

    return new NextResponse(new Uint8Array(combinedBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(combinedBuffer.length),
        "X-Student-Count": String(students.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/reports/generate]", message);
    return NextResponse.json(
      { error: `Report generation failed: ${message}` },
      { status: 500 },
    );
  }
}

// ── Re-export the inner page so the bulk route can compose pages ──────────────
// lib/pdf/ReportCardDocument.tsx must also export ReportCardPageOnly (see note in that file).
// This avoids duplicating the Page layout.
import { ReportCardPageOnly } from "@/lib/pdf/ReportCardDocument";
