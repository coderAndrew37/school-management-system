"use client";

import { useState } from "react";
import { COMPETENCY_DOMAINS } from "@/lib/types/parent";
import type { TalentCompetency, CompetencyKey } from "@/lib/types/parent";

// ── Radar maths ───────────────────────────────────────────────────────────────
const N = COMPETENCY_DOMAINS.length,
  LEVELS = 5,
  CX = 160,
  CY = 160,
  OUTER = 115;
function angle(i: number) {
  return (i / N) * 2 * Math.PI - Math.PI / 2;
}
function pt(r: number, i: number) {
  return { x: CX + r * Math.cos(angle(i)), y: CY + r * Math.sin(angle(i)) };
}
function buildPath(vals: number[]) {
  return (
    vals
      .map((v, i) => {
        const { x, y } = pt((v / LEVELS) * OUTER, i);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") + " Z"
  );
}

const LEVEL_LABEL = [
  "",
  "Beginning",
  "Approaching",
  "Meeting",
  "Exceeding",
  "Exemplary",
];

function RadarGrid() {
  return (
    <g>
      {Array.from({ length: LEVELS }).map((_, lvl) => {
        const r = ((lvl + 1) / LEVELS) * OUTER;
        const d =
          Array.from({ length: N }, (_, i) => pt(r, i))
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`,
            )
            .join(" ") + " Z";
        return (
          <path
            key={lvl}
            d={d}
            fill="none"
            stroke={lvl === LEVELS - 1 ? "#cbd5e1" : "#e2e8f0"}
            strokeWidth={lvl === LEVELS - 1 ? 1.5 : 0.8}
          />
        );
      })}
      {COMPETENCY_DOMAINS.map((_, i) => {
        const o = pt(OUTER, i);
        return (
          <line
            key={i}
            x1={CX}
            y1={CY}
            x2={o.x.toFixed(1)}
            y2={o.y.toFixed(1)}
            stroke="#e2e8f0"
            strokeWidth={0.8}
          />
        );
      })}
      {Array.from({ length: LEVELS }).map((_, lvl) => {
        const p = pt(((lvl + 1) / LEVELS) * OUTER, 0);
        return (
          <text
            key={lvl}
            x={(p.x - 8).toFixed(1)}
            y={(p.y + 4).toFixed(1)}
            fontSize="7"
            fill="#94a3b8"
            textAnchor="end"
          >
            {lvl + 1}
          </text>
        );
      })}
    </g>
  );
}

function RadarPolygon({
  vals,
  color,
  fillOp = 0.15,
  strokeOp = 0.9,
}: {
  vals: number[];
  color: string;
  fillOp?: number;
  strokeOp?: number;
}) {
  const d = buildPath(vals);
  return (
    <g>
      <path
        d={d}
        fill={color}
        fillOpacity={fillOp}
        stroke={color}
        strokeWidth={2}
        strokeOpacity={strokeOp}
      />
      {vals.map((v, i) => {
        const p = pt((v / LEVELS) * OUTER, i);
        return (
          <circle
            key={i}
            cx={p.x.toFixed(1)}
            cy={p.y.toFixed(1)}
            r={3.5}
            fill={color}
            fillOpacity={0.9}
            stroke="white"
            strokeWidth={1.5}
          />
        );
      })}
    </g>
  );
}

function RadarLabels() {
  return (
    <g>
      {COMPETENCY_DOMAINS.map((d, i) => {
        const { x, y } = pt(OUTER + 22, i);
        const cos = Math.cos(angle(i));
        const anchor = cos < -0.1 ? "end" : cos > 0.1 ? "start" : "middle";
        return (
          <g key={i}>
            <text
              x={x.toFixed(1)}
              y={(y - 5).toFixed(1)}
              fontSize="11"
              textAnchor={anchor}
              dominantBaseline="middle"
              fill="#334155"
            >
              {d.icon}
            </text>
            <text
              x={x.toFixed(1)}
              y={(y + 9).toFixed(1)}
              fontSize="7.5"
              textAnchor={anchor}
              dominantBaseline="middle"
              fill="#64748b"
            >
              {d.label.split(" ")[0]}
            </text>
          </g>
        );
      })}
    </g>
  );
}

interface Props {
  competencies: TalentCompetency[];
  studentName: string;
}

export function CompetencyRadar({ competencies, studentName }: Props) {
  const [activeTerm, setActiveTerm] = useState(
    competencies[competencies.length - 1]?.term ?? 1,
  );
  const [compareMode, setCompareMode] = useState(false);

  if (competencies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-14 text-center">
        <p className="text-3xl mb-2">📊</p>
        <p className="font-bold text-slate-500">No competency ratings yet</p>
        <p className="text-xs text-slate-400 mt-1">
          Teacher ratings will appear here once submitted.
        </p>
      </div>
    );
  }

  const current = competencies.find((c) => c.term === activeTerm);
  const prev = compareMode
    ? competencies.find((c) => c.term === activeTerm - 1)
    : null;
  const getVals = (c: TalentCompetency) =>
    COMPETENCY_DOMAINS.map((d) => c[d.key as CompetencyKey] as number);
  const currVals = current ? getVals(current) : COMPETENCY_DOMAINS.map(() => 0);
  const prevVals = prev ? getVals(prev) : null;
  const avg = currVals.reduce((a, b) => a + b, 0) / currVals.length;

  return (
    <div className="space-y-4">
      {/* ── Controls ────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Term tabs — .docket-tab style */}
        <div className="flex items-center gap-2 flex-wrap">
          {competencies.map((c) => (
            <button
              key={c.term}
              onClick={() => setActiveTerm(c.term)}
              className={[
                "rounded-full border px-4 py-1.5 text-xs font-bold transition-all active:scale-95",
                activeTerm === c.term
                  ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
              ].join(" ")}
            >
              Term {c.term}
            </button>
          ))}
        </div>
        {competencies.length > 1 && (
          <button
            onClick={() => setCompareMode((v) => !v)}
            className={[
              "rounded-xl border px-3 py-1.5 text-xs font-bold transition-all active:scale-95 shadow-sm",
              compareMode
                ? "border-cyan-200 bg-cyan-100 text-cyan-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
            ].join(" ")}
          >
            {compareMode ? "Comparing ✓" : "Compare terms"}
          </button>
        )}
      </div>

      {/* ── Average score — .stat-card .sc-purple style ────────────────────── */}
      <div className="rounded-2xl border border-purple-200 bg-purple-50 px-4 py-3 flex items-center gap-4 shadow-sm">
        <div className="text-center flex-shrink-0">
          <p className="text-2xl font-black text-purple-700 tabular-nums leading-none">
            {avg.toFixed(1)}
            <span className="text-sm font-semibold text-purple-400">/5</span>
          </p>
          <p className="text-[9px] font-black uppercase tracking-widest text-purple-500 mt-1">
            Avg · Term {activeTerm}
          </p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-2 rounded-full bg-purple-200 overflow-hidden mb-1.5">
            <div
              className="h-full rounded-full bg-purple-500 transition-all duration-700"
              style={{ width: `${(avg / LEVELS) * 100}%` }}
            />
          </div>
          <p className="text-xs font-semibold text-purple-600">
            {LEVEL_LABEL[Math.round(avg)] ?? ""}
          </p>
        </div>
      </div>

      {/* ── Radar + bars ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4">
        {/* SVG */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center justify-center shadow-sm">
          <svg
            viewBox="0 0 320 320"
            width="100%"
            style={{ maxWidth: 320 }}
            aria-label={`Competency radar for ${studentName}`}
          >
            <RadarGrid />
            {prevVals && (
              <RadarPolygon
                vals={prevVals}
                color="#22d3ee"
                fillOp={0.07}
                strokeOp={0.4}
              />
            )}
            <RadarPolygon
              vals={currVals}
              color="#7c3aed"
              fillOp={0.15}
              strokeOp={0.9}
            />
            <RadarLabels />
          </svg>
        </div>

        {/* Domain bars */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
          {COMPETENCY_DOMAINS.map((domain, i) => {
            const val = currVals[i]!;
            const pval = prevVals?.[i] ?? null;
            const delta = pval !== null ? val - pval : null;
            return (
              <div key={domain.key} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <span className="text-sm">{domain.icon}</span>
                    {domain.label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {delta !== null && delta !== 0 && (
                      <span
                        className={`text-[9px] font-black ${delta > 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        {delta > 0 ? "▲" : "▼"}
                        {Math.abs(delta)}
                      </span>
                    )}
                    <span className="text-xs font-black text-slate-800 tabular-nums">
                      {val}/5
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(val / LEVELS) * 100}%`,
                      background: domain.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
          {compareMode && prev && (
            <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-xs text-slate-400 font-semibold">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 bg-purple-500 rounded" />
                Term {activeTerm}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-0.5 w-5 bg-cyan-400 rounded" />
                Term {activeTerm - 1}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
