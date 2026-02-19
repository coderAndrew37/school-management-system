import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { fetchStudentsForReports } from "@/lib/data/reports";
import { ReportGenerationPayload } from "@/lib/types/reports";

// This route runs the Python report generator as a subprocess.
// POST /api/reports/generate
// Body: { grade: string, term: number, academic_year: number, mode: "bulk"|"single", student_id?: string }

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      grade: string;
      term: number;
      academic_year: number;
      mode: "bulk" | "single";
    };

    const { grade, term, academic_year, mode } = body;

    if (!term || !academic_year) {
      return NextResponse.json(
        { error: "term and academic_year are required" },
        { status: 400 },
      );
    }

    // Fetch students from Supabase
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

    // Build payload for Python script
    const payload: ReportGenerationPayload = {
      students,
      term,
      academic_year,
      mode: mode ?? "bulk",
    };

    // Resolve script path relative to project root
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "generate_reports.py",
    );

    // Run Python subprocess
    const pdfBytes = await new Promise<Buffer>((resolve, reject) => {
      const py = spawn("python3", [scriptPath], {
        stdio: ["pipe", "pipe", "pipe"],
      });

      const chunks: Buffer[] = [];
      const errChunks: Buffer[] = [];

      py.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
      py.stderr.on("data", (chunk: Buffer) => errChunks.push(chunk));

      py.on("close", (code: number) => {
        if (code !== 0) {
          const errMsg = Buffer.concat(errChunks).toString("utf8");
          reject(
            new Error(`PDF generator exited with code ${code}: ${errMsg}`),
          );
          return;
        }
        resolve(Buffer.concat(chunks));
      });

      py.on("error", (err: Error) => reject(err));

      // Send payload to stdin
      py.stdin.write(JSON.stringify(payload));
      py.stdin.end();
    });

    // Build filename
    const gradeSlug =
      grade && grade !== "all" ? grade.replace(/[\s\/]/g, "_") : "All_Grades";
    const filename = `Kibali_Academy_Reports_Term${term}_${academic_year}_${gradeSlug}.pdf`;

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBytes.length),
        "X-Student-Count": String(students.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Report generation error:", message);
    return NextResponse.json(
      { error: `Report generation failed: ${message}` },
      { status: 500 },
    );
  }
}
