"use client";

// app/_components/shared/DownloadReportButton.tsx
// Four exports:
//   PrintReportButton    — single student, opens PDF in new tab for instant print
//   DownloadReportButton — single student, saves PDF to disk
//   BulkPrintButton      — whole class, opens multi-page PDF in new tab
//   BulkDownloadButton   — whole class, saves multi-page PDF to disk

import { useState } from "react";
import { FileText, Loader2, Download, Printer } from "lucide-react";

// ── Shared ────────────────────────────────────────────────────────────────────

interface Props {
  studentId: string;
  studentName: string;
  term: number;
  year?: number;
  variant?: "button" | "link";
}

interface BulkProps {
  grade: string;
  term: number;
  year?: number;
  studentCount: number;
}

function reportUrl(studentId: string, term: number, year: number) {
  return `/api/report-pdf?studentId=${encodeURIComponent(studentId)}&term=${term}&year=${year}`;
}

// ── PrintReportButton — opens PDF in new tab, teacher hits Ctrl+P ─────────────

export function PrintReportButton({
  studentId,
  studentName,
  term,
  year = 2026,
  variant = "button",
}: Props) {
  function handleClick() {
    window.open(reportUrl(studentId, term, year), "_blank", "noopener");
  }

  if (variant === "link") {
    return (
      <button
        onClick={handleClick}
        aria-label={`Print Term ${term} report for ${studentName}`}
        className="flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 transition-colors"
      >
        <Printer className="h-3.5 w-3.5" />
        Print Report
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      aria-label={`Print Term ${term} report for ${studentName}`}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors"
    >
      <Printer className="h-4 w-4" />
      Print — Term {term}
    </button>
  );
}

// ── DownloadReportButton — saves PDF to disk ──────────────────────────────────

export function DownloadReportButton({
  studentId,
  studentName,
  term,
  year = 2026,
  variant = "button",
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(reportUrl(studentId, term, year));
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `Failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${studentName.replace(/\s+/g, "_")}_Term${term}_${year}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError("Download failed — please try again");
      console.error("[DownloadReportButton]", err);
    } finally {
      setLoading(false);
    }
  }

  if (variant === "link") {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label={`Download Term ${term} report for ${studentName}`}
        className="flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <FileText className="h-3.5 w-3.5" />
        )}
        {loading ? "Generating…" : `Download Term ${term} Report`}
        {error && <span className="text-rose-500 ml-1">— {error}</span>}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label={`Download Term ${term} report for ${studentName}`}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {loading ? "Generating PDF…" : `Download — Term ${term}`}
      </button>
      {error && (
        <p className="text-xs text-rose-500 mt-1.5 font-semibold">{error}</p>
      )}
    </div>
  );
}

// ── BulkPrintButton — whole class PDF, opens in new tab ───────────────────────

export function BulkPrintButton({
  grade,
  term,
  year = 2026,
  studentCount,
}: BulkProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, term, academic_year: year }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `Failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // Open in new tab — browser renders inline, teacher hits Ctrl+P
      window.open(url, "_blank", "noopener");
      // Revoke after 60s — enough time for the new tab to load the PDF
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("Failed — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label={`Print all ${studentCount} report cards for ${grade} Term ${term}`}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Generating{" "}
            {studentCount} pages…
          </>
        ) : (
          <>
            <Printer className="h-4 w-4" /> Print All ({studentCount})
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-rose-500 mt-1.5 font-semibold">{error}</p>
      )}
    </div>
  );
}

// ── BulkDownloadButton — whole class PDF, saves to disk ───────────────────────

export function BulkDownloadButton({
  grade,
  term,
  year = 2026,
  studentCount,
}: BulkProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade, term, academic_year: year }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `Failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${grade.replace(/\s+/g, "_")}_Term${term}_${year}_Reports.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label={`Download all ${studentCount} report cards for ${grade} Term ${term}`}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-sm font-bold transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Generating{" "}
            {studentCount} pages…
          </>
        ) : (
          <>
            <Download className="h-4 w-4" /> Download All ({studentCount})
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-rose-500 mt-1.5 font-semibold">{error}</p>
      )}
    </div>
  );
}
