// ============================================================
// lib/utils/kpsea-exporter.ts
// Grade 6 KPSEA — cumulative SBA Excel export using SheetJS
// ============================================================
// Matches KNEC KPSEA upload format (Assessment Number, Name, 5 areas + total)

import type { KPSEAStudentRow } from "@/types/knec";
import { KPSEA_AREAS } from "@/types/knec";
import * as XLSX from "xlsx";

// ── Types ─────────────────────────────────────────────────────────────────────

type ExcelRow = Record<string, string | number>;

export interface KPSEAValidationReport {
  missingAssessmentNumber: string[];
  missingUpi: string[];
  missingYears: { fullName: string; missingGrades: string[] }[];
  canExport: boolean;
}

// ── Validation ────────────────────────────────────────────────────────────────

export function validateKPSEAData(
  rows: KPSEAStudentRow[],
): KPSEAValidationReport {
  const missingAssessmentNumber: string[] = [];
  const missingUpi: string[] = [];
  const missingYears: { fullName: string; missingGrades: string[] }[] = [];

  for (const r of rows) {
    if (!r.assessmentNumber) missingAssessmentNumber.push(r.fullName);
    if (!r.upiNumber) missingUpi.push(r.fullName);

    const missing: string[] = [];
    if (r.historicalData.g4.status === "missing") missing.push("Grade 4");
    if (r.historicalData.g5.status === "missing") missing.push("Grade 5");
    if (r.historicalData.g6.status === "missing") missing.push("Grade 6");
    if (missing.length > 0)
      missingYears.push({ fullName: r.fullName, missingGrades: missing });
  }

  return {
    missingAssessmentNumber,
    missingUpi,
    missingYears,
    canExport:
      missingAssessmentNumber.length === 0 &&
      missingUpi.length === 0 &&
      missingYears.length === 0,
  };
}

// ── Excel builder ─────────────────────────────────────────────────────────────

export function buildKPSEAExcel(
  rows: KPSEAStudentRow[],
  g6Year: number = 2026,
): Blob {
  // Only include students who have all data
  const exportable = rows.filter(
    (r) => r.readinessStatus === "ready" && r.totalSBA !== null,
  );

  const dataRows: ExcelRow[] = exportable.map((r, idx) => {
    const row: ExcelRow = {
      "No.": idx + 1,
      "Assessment Number": r.assessmentNumber ?? "",
      UPI: r.upiNumber ?? "",
      "Full Name": r.fullName,
      Gender: r.gender ?? "",
    };

    for (const area of KPSEA_AREAS) {
      const score = r.scores.find((s) => s.area === area);
      row[area] =
        score?.sba60 != null ? parseFloat(score.sba60.toFixed(2)) : "—";
      row[`${area} (Avg%)`] =
        score?.avgPct != null ? parseFloat(score.avgPct.toFixed(2)) : "—";
    }

    row["Total SBA (60%)"] = r.totalSBA ?? "—";
    return row;
  });

  const areaHeaders = KPSEA_AREAS.flatMap((a) => [a, `${a} (Avg%)`]);
  const headers = [
    "No.",
    "Assessment Number",
    "UPI",
    "Full Name",
    "Gender",
    ...areaHeaders,
    "Total SBA (60%)",
  ];

  const worksheet = XLSX.utils.json_to_sheet(dataRows, { header: headers });
  worksheet["!cols"] = headers.map((h) => ({
    wch: Math.max(h.length + 2, 18),
  }));

  // Title row
  XLSX.utils.sheet_add_aoa(
    worksheet,
    [[`Kibali Academy — Grade 6 KPSEA SBA Export | AY ${g6Year}`]],
    { origin: "A1" },
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "KPSEA SBA");

  // Second sheet: summary with readiness flags
  const summaryRows: ExcelRow[] = rows.map((r) => ({
    "Full Name": r.fullName,
    "Assessment Number": r.assessmentNumber ?? "MISSING",
    UPI: r.upiNumber ?? "MISSING",
    "G4 Status": r.historicalData.g4.status,
    "G5 Status": r.historicalData.g5.status,
    "G6 Status": r.historicalData.g6.status,
    "Total SBA (60%)": r.totalSBA ?? "—",
    Readiness: r.readinessStatus,
    "Has Overrides": r.hasOverrides ? "Yes" : "No",
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Readiness Summary");

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Trigger browser download of KPSEA Excel */
export function downloadKPSEAExcel(
  rows: KPSEAStudentRow[],
  g6Year: number = 2026,
): void {
  const blob = buildKPSEAExcel(rows, g6Year);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Kibali_Grade6_KPSEA_SBA_${g6Year}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
