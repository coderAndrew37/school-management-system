"use client";

// components/DownloadReportButton.tsx
// Single-student PDF download.
// Calls GET /api/report-pdf?studentId=...&term=...&year=...

import { useState } from "react";
import { FileText, Loader2, Download } from "lucide-react";

interface Props {
  studentId: string;
  studentName: string;
  term: number;
  year?: number;
  variant?: "button" | "link";
}

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
      const url = `/api/report-pdf?studentId=${encodeURIComponent(studentId)}&term=${term}&year=${year}`;
      const res = await fetch(url);

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? `Failed (${res.status})`);
        return;
      }

      // Stream the PDF into a blob and trigger download
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
        {loading ? "Generating PDF…" : `Download Report — Term ${term}`}
      </button>
      {error && (
        <p className="text-xs text-rose-500 mt-1.5 font-semibold">{error}</p>
      )}
    </div>
  );
}
