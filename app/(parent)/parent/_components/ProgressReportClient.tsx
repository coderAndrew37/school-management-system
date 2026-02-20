"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Image as ImageIcon,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type {
  Assessment,
  AssessmentCardProps,
  CompetencyRadarProps,
  CbcScore,
  ProgressReportClientProps,
  ScoreBadgeProps,
  TermTabsProps,
} from "@/lib/types/parent";
import {
  CBC_SCORES,
  getInitials,
  getAvatarColor,
  getOverallLevel,
  getTerms,
  buildRadarData,
  groupBySubject,
} from "@/lib/helpers/parent";

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: ScoreBadgeProps) {
  const meta = CBC_SCORES[score];
  return (
    <span
      className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold border ${meta.bg} ${meta.color} ${meta.border}`}
    >
      {score}
    </span>
  );
}

// ── Score legend ──────────────────────────────────────────────────────────────

function ScoreLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {(
        Object.entries(CBC_SCORES) as [
          CbcScore,
          (typeof CBC_SCORES)[CbcScore],
        ][]
      ).map(([score, meta]) => (
        <div
          key={score}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 ${meta.bg} ${meta.border}`}
        >
          <span className={`text-xs font-bold ${meta.color}`}>{score}</span>
          <span className="text-xs text-stone-500">{meta.description}</span>
        </div>
      ))}
    </div>
  );
}

// ── Radar chart ───────────────────────────────────────────────────────────────

const RADAR_SCORE_LABELS: Record<1 | 2 | 3 | 4, CbcScore> = {
  1: "BE",
  2: "AE",
  3: "ME",
  4: "EE",
};

function CompetencyRadar({ data }: CompetencyRadarProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-56 text-center">
        <p className="text-4xl mb-2">📊</p>
        <p className="text-stone-400 text-sm">No assessment data yet</p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart
          data={data}
          margin={{ top: 10, right: 30, bottom: 10, left: 30 }}
        >
          <PolarGrid stroke="#e7e5e4" strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#78716c", fontSize: 11, fontWeight: 600 }}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.25}
            strokeWidth={2.5}
            dot={{ fill: "#f59e0b", r: 4, strokeWidth: 0 }}
          />
          <Tooltip
            formatter={(value: number) => [
              RADAR_SCORE_LABELS[value as 1 | 2 | 3 | 4] ?? value,
              "Level",
            ]}
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e7e5e4",
              fontSize: "12px",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Term tabs ─────────────────────────────────────────────────────────────────

function TermTabs({ terms, active, onSelect }: TermTabsProps) {
  const baseClass =
    "rounded-xl px-4 py-2 text-sm font-semibold transition-all duration-200 flex-shrink-0";
  const activeClass = "bg-amber-500 text-white shadow-sm";
  const inactiveClass =
    "bg-white border border-stone-200 text-stone-500 hover:border-amber-300";

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => onSelect(0)}
        className={`${baseClass} ${active === 0 ? activeClass : inactiveClass}`}
      >
        All Terms
      </button>
      {terms.map((term) => (
        <button
          key={term}
          onClick={() => onSelect(term)}
          className={`${baseClass} ${active === term ? activeClass : inactiveClass}`}
        >
          Term {term}
        </button>
      ))}
    </div>
  );
}

// ── Assessment card ───────────────────────────────────────────────────────────

function AssessmentCard({ assessment }: AssessmentCardProps) {
  const [showEvidence, setShowEvidence] = useState<boolean>(false);

  return (
    <div className="rounded-2xl bg-white border border-stone-100 p-4 shadow-sm space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <BookOpen className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-stone-700">
              {assessment.subject_name}
            </p>
            <p className="text-xs text-stone-400">
              Strand: {assessment.strand_id} · Term {assessment.term}
            </p>
          </div>
        </div>
        {assessment.score !== null && <ScoreBadge score={assessment.score} />}
      </div>

      {/* Teacher remarks */}
      {assessment.teacher_remarks !== null && (
        <div className="flex gap-2 rounded-xl bg-stone-50 border border-stone-100 p-3">
          <MessageSquare className="h-4 w-4 text-stone-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-stone-600 leading-relaxed">
            {assessment.teacher_remarks}
          </p>
        </div>
      )}

      {/* Evidence photo */}
      {assessment.evidence_url !== null && (
        <div>
          <button
            onClick={() => setShowEvidence((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-sky-700 transition-colors"
          >
            <ImageIcon className="h-3.5 w-3.5" />
            {showEvidence ? "Hide" : "View"} evidence photo
          </button>
          {showEvidence && (
            <div className="mt-2 rounded-xl overflow-hidden border border-stone-100">
              <img
                src={assessment.evidence_url}
                alt={`Evidence for ${assessment.subject_name} — ${assessment.strand_id}`}
                className="w-full object-cover max-h-48"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProgressReportClient({ child }: ProgressReportClientProps) {
  const [activeTerm, setActiveTerm] = useState<0 | 1 | 2 | 3>(0);

  const initials = getInitials(child.full_name);
  const avatarColor = getAvatarColor(child.full_name);
  const overall = getOverallLevel(child.assessments);
  const firstName = child.full_name.split(" ")[0] ?? child.full_name;

  const terms = useMemo(() => getTerms(child.assessments), [child.assessments]);

  const filtered = useMemo<Assessment[]>(
    () =>
      activeTerm === 0
        ? child.assessments
        : child.assessments.filter((a) => a.term === activeTerm),
    [child.assessments, activeTerm],
  );

  const radarData = useMemo(() => buildRadarData(filtered), [filtered]);

  const bySubject = useMemo(() => groupBySubject(filtered), [filtered]);

  return (
    <div className="space-y-6">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <Link
          href={`/parent/child/${child.id}`}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white border border-stone-200 shadow-sm hover:border-amber-300 transition-all duration-200"
        >
          <ArrowLeft className="h-4 w-4 text-stone-500" />
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`h-10 w-10 rounded-xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-sm font-bold text-white flex-shrink-0`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-stone-400 font-medium">
              Progress Report
            </p>
            <h1 className="text-lg font-bold text-stone-800 truncate">
              {firstName}
            </h1>
          </div>
        </div>
      </div>

      {/* Overall level banner */}
      <div className="flex items-center gap-3 rounded-2xl bg-white border border-stone-100 px-4 py-3.5 shadow-sm">
        <TrendingUp className="h-5 w-5 text-amber-500 flex-shrink-0" />
        <div>
          <p className="text-xs text-stone-400 font-medium">Overall Level</p>
          <p className={`text-sm font-bold ${overall.color}`}>
            {overall.emoji} {overall.label}
          </p>
        </div>
        <p className="text-xs text-stone-400 ml-auto">
          {child.assessments.length}{" "}
          {child.assessments.length === 1 ? "assessment" : "assessments"}
        </p>
      </div>

      {/* CBC score legend */}
      <ScoreLegend />

      {/* Radar chart card */}
      <div className="rounded-3xl bg-white border border-stone-100 p-5 shadow-sm">
        <h2 className="text-sm font-bold text-stone-600 mb-1">
          Competency Overview
        </h2>
        <p className="text-xs text-stone-400 mb-4">
          Latest score per subject · Scale: BE → AE → ME → EE
        </p>
        <CompetencyRadar data={radarData} />
      </div>

      {/* Term filter tabs */}
      {terms.length > 1 && (
        <TermTabs terms={terms} active={activeTerm} onSelect={setActiveTerm} />
      )}

      {/* Assessments grouped by subject */}
      {bySubject.size === 0 ? (
        <div className="rounded-2xl bg-white border border-stone-100 p-10 text-center shadow-sm">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-stone-500 font-medium text-sm">
            No assessments for this term
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(bySubject.entries()).map(([subject, assessments]) => (
            <div key={subject}>
              <h3 className="text-sm font-bold text-stone-600 mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-500" />
                {subject}
              </h3>
              <div className="space-y-3">
                {assessments.map((assessment) => (
                  <AssessmentCard key={assessment.id} assessment={assessment} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
