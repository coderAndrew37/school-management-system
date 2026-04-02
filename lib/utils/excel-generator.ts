// ============================================================
// lib/utils/excel-generator.ts
// Grade 3 MLP — KNEC Excel export using SheetJS (xlsx)
// ============================================================
// Install: npm install xlsx
// Import in a "use client" component or Next.js route handler.

import * as XLSX from "xlsx";
import type { Grade3StudentResult, Grade3LearningArea } from "@/types/knec";
import { GRADE3_LEARNING_AREAS } from "@/types/knec";

// ── Validation ────────────────────────────────────────────────────────────────

export interface Grade3ValidationReport {
  missingUpi: string[]; // full_name of students without UPI
  missingAreas: { fullName: string; areas: Grade3LearningArea[] }[];
  canExport: boolean;
}

export function validateGrade3Data(
  results: Grade3StudentResult[],
): Grade3ValidationReport {
  const missingUpi: string[] = [];
  const missingAreas: { fullName: string; areas: Grade3LearningArea[] }[] = [];

  for (const r of results) {
    const upiIssue = r.issues.some((i) => i.type === "missing_upi");
    const areaIssues = r.issues
      .filter(
        (i): i is { type: "missing_area"; area: Grade3LearningArea } =>
          i.type === "missing_area",
      )
      .map((i) => i.area);

    if (upiIssue) missingUpi.push(r.fullName);
    if (areaIssues.length > 0)
      missingAreas.push({ fullName: r.fullName, areas: areaIssues });
  }

  return {
    missingUpi,
    missingAreas,
    canExport: missingUpi.length === 0 && missingAreas.length === 0,
  };
}

// ── Excel builder ─────────────────────────────────────────────────────────────

type ExcelRow = Record<string, string | number>;

export function buildGrade3Excel(
  results: Grade3StudentResult[],
  grade: string = "Grade 3",
  year: number = 2026,
): Blob {
  // Only export rows that have no blocking issues
  const exportable = results.filter(
    (r) => !r.issues.some((i) => i.type === "missing_upi"),
  );

  const rows: ExcelRow[] = exportable.map((r, idx) => {
    const row: ExcelRow = {
      "No.": idx + 1,
      "Assessment Number": r.upiNumber ?? "",
      "Full Name": r.fullName,
      Gender: r.gender ?? "",
    };

    for (const area of GRADE3_LEARNING_AREAS) {
      row[area] = r.areas[area] ?? "—";
    }

    return row;
  });

  // Column order that matches KNEC MLP upload format
  const headers = [
    "No.",
    "Assessment Number",
    "Full Name",
    "Gender",
    ...GRADE3_LEARNING_AREAS,
  ];

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Column widths
  worksheet["!cols"] = headers.map((h) => ({
    wch: Math.max(h.length + 2, 14),
  }));

  // Header row styling (bold, blue fill) — requires xlsx-style or ExcelJS for full support
  // Basic approach: add a title row above data
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [[`Kibali Academy — Grade 3 MLP Export | ${grade} | AY ${year}`]],
    { origin: "A1" },
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Grade 3 MLP");

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Trigger a browser download of the Grade 3 MLP Excel file */
export function downloadGrade3Excel(
  results: Grade3StudentResult[],
  year: number = 2026,
): void {
  const blob = buildGrade3Excel(results, "Grade 3", year);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Kibali_Grade3_MLP_${year}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
