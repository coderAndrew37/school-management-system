"use client";

// app/_components/shared/DownloadReportButton.tsx
// Four exports:
//   PrintReportButton    — single student, fetches PDF blob and triggers print dialog
//   DownloadReportButton — single student, saves PDF to disk
//   BulkPrintButton      — whole class, fetches multi-page PDF and triggers print dialog
//   BulkDownloadButton   — whole class, saves multi-page PDF to disk
//
// Print strategy: fetch the PDF as a blob → inject a hidden <iframe> → call
// iframe.contentWindow.print(). This works reliably across all browsers because:
//   - window.open(blobUrl) is blocked by popup blockers in most browsers
//   - window.open(apiUrl, "_blank") requires the user to allow the PDF to render
//     before they can print — there's no way to trigger print() on a cross-origin tab
//   - The iframe approach is synchronous and never requires popup permission

import { useState } from "react";
import { Download, FileText, Loader2, Printer } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Shared helpers ────────────────────────────────────────────────────────────

function reportUrl(studentId: string, term: number, year: number) {
  return `/api/report-pdf?studentId=${encodeURIComponent(studentId)}&term=${term}&year=${year}`;
}

function bulkUrl(grade: string, term: number, year: number) {
  // Bulk route is a POST — used via fetch, not a direct URL
  return { grade, term, academic_year: year };
}

/**
 * Fetch a PDF blob from url/body, inject a hidden iframe, and call print().
 * The iframe is removed after the print dialog closes (or after 2 min timeout).
 */
async function printPdfBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
    iframe.src = objectUrl;

    function cleanup() {
      URL.revokeObjectURL(objectUrl);
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      resolve();
    }

    iframe.onload = () => {
      try {
        // Small delay lets the PDF renderer finish painting before print dialog
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          // Clean up after 2 min (covers slow machines + time in print dialog)
          setTimeout(cleanup, 120_000);
        }, 500);
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    iframe.onerror = () => {
      cleanup();
      reject(new Error("PDF failed to load in iframe"));
    };

    document.body.appendChild(iframe);
  });
}

// ── PrintReportButton — single student ───────────────────────────────────────

export function PrintReportButton({
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
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? `Error ${res.status}`);
        return;
      }
      const blob = await res.blob();
      await printPdfBlob(blob);
    } catch {
      setError("Print failed — please try again");
    } finally {
      setLoading(false);
    }
  }

  if (variant === "link") {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label={`Print Term ${term} report for ${studentName}`}
        className="flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Printer className="h-3.5 w-3.5" />
        )}
        {loading ? "Generating…" : "Print Report"}
        {error && <span className="text-rose-500 ml-1">— {error}</span>}
      </button>
    );
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        aria-label={`Print Term ${term} report for ${studentName}`}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Printer className="h-4 w-4" />
        )}
        {loading ? "Generating…" : `Print — Term ${term}`}
      </button>
      {error && (
        <p className="text-xs text-rose-500 mt-1.5 font-semibold">{error}</p>
      )}
    </div>
  );
}

// ── DownloadReportButton — single student ─────────────────────────────────────

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
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? `Error ${res.status}`);
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
    } catch {
      setError("Download failed — please try again");
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

// ── BulkPrintButton — whole class ─────────────────────────────────────────────

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
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? `Error ${res.status}`);
        return;
      }
      const blob = await res.blob();
      await printPdfBlob(blob);
    } catch {
      setError("Print failed — please try again");
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

// ── BulkDownloadButton — whole class ──────────────────────────────────────────

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
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        setError(json.error ?? `Error ${res.status}`);
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
