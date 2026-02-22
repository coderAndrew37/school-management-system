import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { fetchStudentsForReports } from "@/lib/data/reports";
import { ReportGenerationPayload } from "@/lib/types/reports";

/**
 * POST /api/reports/generate
 * Body: { grade: string, term: number, academic_year: number, mode: "bulk" | "single" }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json()) as {
      grade: string;
      term: number;
      academic_year: number;
      mode: "bulk" | "single";
    };

    const { grade, term, academic_year, mode } = body;

    // 1. Validation
    if (!term || !academic_year) {
      return NextResponse.json(
        { error: "term and academic_year are required" },
        { status: 400 },
      );
    }

    // 2. Data Fetching
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

    // 3. Prepare Subprocess
    const payload: ReportGenerationPayload = {
      students,
      term,
      academic_year,
      mode: mode ?? "bulk",
    };

    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "generate_reports.py",
    );

    // 4. Execute Python Generator
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      // Use 'python3' for Linux/macOS or 'python' for Windows depending on your environment
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

      // Send JSON payload to Python via stdin
      py.stdin.write(JSON.stringify(payload));
      py.stdin.end();
    });

    // 5. Response Construction
    const gradeSlug =
      grade && grade !== "all" ? grade.replace(/[\s\/]/g, "_") : "All_Grades";

    const filename = `Kibali_Academy_Reports_Term${term}_${academic_year}_${gradeSlug}.pdf`;

    /**
     * FIX: We wrap the Node.js Buffer in a Uint8Array.
     * This satisfies the Web Standard 'BodyInit' type required by NextResponse.
     */
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
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
