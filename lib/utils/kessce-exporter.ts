// ============================================================
// lib/utils/kessce-exporter.ts
// Grade 9 KESSCE — Excel export with pathway + senior school track column
// ============================================================

import * as XLSX from "xlsx";
import type { IKESSCEResult } from "@/types/knec";
import { JSS_CORE_SUBJECTS } from "@/types/knec";

// ── Row type — no `any` ───────────────────────────────────────────────────────

type ExcelCellValue = string | number;
type ExcelRow = Record<string, ExcelCellValue>;

// ── Validation ────────────────────────────────────────────────────────────────

export interface KESSCEValidationReport {
  missingUpi: string[];
  missingPathway: string[];
  counselingRequired: string[];
  canExport: boolean;
}

export function validateKESSCEData(
  results: IKESSCEResult[],
): KESSCEValidationReport {
  const missingUpi: string[] = [];
  const missingPathway: string[] = [];
  const counselingRequired: string[] = [];

  for (const r of results) {
    if (r.exportIssues.some((i) => i.type === "missing_upi"))
      missingUpi.push(r.fullName);
    if (r.exportIssues.some((i) => i.type === "missing_pathway"))
      missingPathway.push(r.fullName);
    if (r.counseling.required) counselingRequired.push(r.fullName);
  }

  return {
    missingUpi,
    missingPathway,
    counselingRequired,
    // Export is blocked only for missing UPI or missing pathway.
    // Counseling flags are included as a warning column, not a blocker.
    canExport: missingUpi.length === 0 && missingPathway.length === 0,
  };
}

// ── Excel builder ─────────────────────────────────────────────────────────────

export function buildKESSCEExcel(
  results: IKESSCEResult[],
  g9Year: number = 2026,
): Blob {
  // Sheet 1 — Main KESSCE data
  const exportable = results.filter(
    (r) =>
      !r.exportIssues.some(
        (i) => i.type === "missing_upi" || i.type === "missing_pathway",
      ),
  );

  const dataRows: ExcelRow[] = exportable.map((r, idx) => {
    const row: ExcelRow = {
      "No.": idx + 1,
      "UPI Number": r.upiNumber ?? "MISSING",
      "Full Name": r.fullName,
      Gender: r.gender ?? "",
      "Recommended Senior School Track":
        r.pathway.seniorSchoolTrack ?? "Not Set",
      "Pathway Cluster": r.pathway.pathwayCluster ?? "",
      "Overall SBA Avg (%)": r.overallAvgPct ?? "—",
      "Counseling Required": r.counseling.required ? "YES" : "No",
      "Counseling Reason": r.counseling.reasons.join("; "),
      "Learner Profile Notes": r.pathway.learnerProfile,
    };

    // Per-subject 3-year averages
    for (const subject of JSS_CORE_SUBJECTS) {
      const avg = r.subjectAverages.find((s) => s.subject === subject);
      row[subject] =
        avg?.avgPct != null ? parseFloat(avg.avgPct.toFixed(1)) : "—";
      row[`${subject} (G7)`] =
        avg?.g7Pct != null ? parseFloat(avg.g7Pct.toFixed(1)) : "—";
      row[`${subject} (G8)`] =
        avg?.g8Pct != null ? parseFloat(avg.g8Pct.toFixed(1)) : "—";
      row[`${subject} (G9)`] =
        avg?.g9Pct != null ? parseFloat(avg.g9Pct.toFixed(1)) : "—";
    }

    return row;
  });

  const subjectHeaders = JSS_CORE_SUBJECTS.flatMap((s) => [
    s,
    `${s} (G7)`,
    `${s} (G8)`,
    `${s} (G9)`,
  ]);

  const headers: string[] = [
    "No.",
    "UPI Number",
    "Full Name",
    "Gender",
    "Recommended Senior School Track",
    "Pathway Cluster",
    "Overall SBA Avg (%)",
    "Counseling Required",
    "Counseling Reason",
    ...subjectHeaders,
    "Learner Profile Notes",
  ];

  const dataSheet = XLSX.utils.json_to_sheet(dataRows, { header: headers });
  dataSheet["!cols"] = headers.map((h) => ({
    wch: Math.max(h.length + 2, 16),
  }));

  // Title row at A1
  XLSX.utils.sheet_add_aoa(
    dataSheet,
    [[`Kibali Academy — Grade 9 KESSCE Export | AY ${g9Year}`]],
    { origin: "A1" },
  );

  // Sheet 2 — Counseling dashboard
  const counselingRows: ExcelRow[] = results
    .filter((r) => r.counseling.required)
    .map((r) => ({
      "Full Name": r.fullName,
      UPI: r.upiNumber ?? "MISSING",
      "Pathway Cluster": r.pathway.pathwayCluster ?? "Not Set",
      "Senior Track": r.pathway.seniorSchoolTrack ?? "Not Set",
      "Maths Avg (%)":
        r.subjectAverages.find((s) => s.subject === "Mathematics")?.avgPct ??
        "—",
      "Science Avg (%)":
        r.subjectAverages.find((s) => s.subject === "Integrated Science")
          ?.avgPct ?? "—",
      "Counseling Reasons": r.counseling.reasons.join("; "),
    }));

  const counselingSheet = XLSX.utils.json_to_sheet(counselingRows);
  counselingSheet["!cols"] = Array(7).fill({ wch: 24 });

  // Sheet 3 — Full readiness summary
  const summaryRows: ExcelRow[] = results.map((r) => ({
    "Full Name": r.fullName,
    UPI: r.upiNumber ?? "MISSING",
    Gender: r.gender ?? "",
    "Senior Track": r.pathway.seniorSchoolTrack ?? "Not Set",
    "Pathway Cluster": r.pathway.pathwayCluster ?? "Not Set",
    "Overall SBA (%)": r.overallAvgPct ?? "—",
    "Export Blocking Issues":
      r.exportIssues
        .filter((i) => i.type !== "counseling_required")
        .map((i) => i.type)
        .join(", ") || "None",
    "Counseling Required": r.counseling.required ? "YES" : "No",
  }));

  const summarySheet = XLSX.utils.json_to_sheet(summaryRows);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dataSheet, "KESSCE Export");
  XLSX.utils.book_append_sheet(workbook, counselingSheet, "Counseling List");
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Readiness Summary");

  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Trigger browser download */
export function downloadKESSCEExcel(
  results: IKESSCEResult[],
  g9Year: number = 2026,
): void {
  const blob = buildKESSCEExcel(results, g9Year);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Kibali_Grade9_KESSCE_${g9Year}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
