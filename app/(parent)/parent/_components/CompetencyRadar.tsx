"use client";

import { useState } from "react";
import { COMPETENCY_DOMAINS } from "@/lib/types/parent";
import type { TalentCompetency, CompetencyKey } from "@/lib/types/parent";

// ── Maths helpers ─────────────────────────────────────────────────────────────

const N = COMPETENCY_DOMAINS.length; // 8
const LEVELS = 5;
const CENTER = 160;
const OUTER = 130;

function angleFor(i: number) {
  // Start from top (-90°), go clockwise
  return (i / N) * 2 * Math.PI - Math.PI / 2;
}

function polarToXY(radius: number, i: number) {
  const a = angleFor(i);
  return { x: CENTER + radius * Math.cos(a), y: CENTER + radius * Math.sin(a) };
}

function buildPath(values: number[]): string {
  return (
    values
      .map((v, i) => {
        const r = (v / LEVELS) * OUTER;
        const { x, y } = polarToXY(r, i);
        return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ") + " Z"
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RadarGrid() {
  return (
    <g>
      {/* Concentric rings */}
      {Array.from({ length: LEVELS }).map((_, lvl) => {
        const r = ((lvl + 1) / LEVELS) * OUTER;
        const pts = Array.from({ length: N }, (_, i) => polarToXY(r, i));
        const d =
          pts
            .map(
              (p, i) =>
                `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`,
            )
            .join(" ") + " Z";
        return (
          <path
            key={lvl}
            d={d}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth={lvl === LEVELS - 1 ? 1.5 : 0.8}
          />
        );
      })}
      {/* Spokes */}
      {COMPETENCY_DOMAINS.map((_, i) => {
        const outer = polarToXY(OUTER, i);
        return (
          <line
            key={i}
            x1={CENTER}
            y1={CENTER}
            x2={outer.x.toFixed(2)}
            y2={outer.y.toFixed(2)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={0.8}
          />
        );
      })}
      {/* Level labels (1-5 on one spoke) */}
      {Array.from({ length: LEVELS }).map((_, lvl) => {
        const r = ((lvl + 1) / LEVELS) * OUTER;
        const p = polarToXY(r, 0); // top spoke
        return (
          <text
            key={lvl}
            x={(p.x - 10).toFixed(2)}
            y={(p.y + 4).toFixed(2)}
            fontSize="8"
            fill="rgba(255,255,255,0.25)"
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
  values,
  color,
  opacity = 0.18,
  strokeOpacity = 0.8,
}: {
  values: number[];
  color: string;
  opacity?: number;
  strokeOpacity?: number;
}) {
  const d = buildPath(values);
  return (
    <g>
      <path
        d={d}
        fill={color}
        fillOpacity={opacity}
        stroke={color}
        strokeWidth={1.5}
        strokeOpacity={strokeOpacity}
      />
      {values.map((v, i) => {
        const r = (v / LEVELS) * OUTER;
        const p = polarToXY(r, i);
        return (
          <circle
            key={i}
            cx={p.x.toFixed(2)}
            cy={p.y.toFixed(2)}
            r={3.5}
            fill={color}
            fillOpacity={0.9}
            stroke="#0c0f1a"
            strokeWidth={1.5}
          />
        );
      })}
    </g>
  );
}

function RadarLabels() {
  const labelR = OUTER + 22;
  return (
    <g>
      {COMPETENCY_DOMAINS.map((domain, i) => {
        const { x, y } = polarToXY(labelR, i);
        const angle = angleFor(i) * (180 / Math.PI);

        // Anchor based on quadrant
        const isLeft = Math.cos(angleFor(i)) < -0.1;
        const isRight = Math.cos(angleFor(i)) > 0.1;
        const anchor = isLeft ? "end" : isRight ? "start" : "middle";

        return (
          <g key={i}>
            <text
              x={x.toFixed(2)}
              y={(y - 4).toFixed(2)}
              fontSize="9"
              fontWeight="600"
              fill="rgba(255,255,255,0.7)"
              textAnchor={anchor}
              dominantBaseline="middle"
            >
              {domain.icon}
            </text>
            <text
              x={x.toFixed(2)}
              y={(y + 9).toFixed(2)}
              fontSize="8"
              fill="rgba(255,255,255,0.45)"
              textAnchor={anchor}
              dominantBaseline="middle"
            >
              {domain.label}
            </text>
          </g>
        );
      })}
    </g>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  competencies: TalentCompetency[];
  studentName: string;
}

export function CompetencyRadar({ competencies, studentName }: Props) {
  const [activeTerm, setActiveTerm] = useState<number>(
    competencies[competencies.length - 1]?.term ?? 1,
  );
  const [compareMode, setCompareMode] = useState(false);

  if (competencies.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
        <p className="text-3xl mb-2">📊</p>
        <p className="text-sm text-white/40">No competency ratings yet</p>
        <p className="text-xs text-white/25 mt-1">
          Teacher ratings will appear here once submitted.
        </p>
      </div>
    );
  }

  const current = competencies.find((c) => c.term === activeTerm);
  const prev = compareMode
    ? competencies.find((c) => c.term === activeTerm - 1)
    : null;

  const getValues = (comp: TalentCompetency): number[] =>
    COMPETENCY_DOMAINS.map((d) => comp[d.key as CompetencyKey] as number);

  const currentValues = current
    ? getValues(current)
    : COMPETENCY_DOMAINS.map(() => 0);
  const prevValues = prev ? getValues(prev) : null;

  // Average score
  const avg = currentValues.reduce((a, b) => a + b, 0) / currentValues.length;

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1">
          {competencies.map((c) => (
            <button
              key={c.term}
              onClick={() => setActiveTerm(c.term)}
              className={[
                "rounded-lg px-4 py-1.5 text-xs font-semibold transition-all",
                activeTerm === c.term
                  ? "bg-purple-500 text-white"
                  : "text-white/40 hover:text-white",
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
              "rounded-xl px-3.5 py-2 text-xs font-semibold border transition-all",
              compareMode
                ? "border-sky-400/40 bg-sky-400/10 text-sky-400"
                : "border-white/10 text-white/40 hover:text-white hover:border-white/20",
            ].join(" ")}
          >
            {compareMode ? "Comparing terms" : "Compare with previous"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* SVG Radar */}
        <div className="lg:col-span-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 flex items-center justify-center">
          <svg
            viewBox="0 0 320 320"
            width="100%"
            style={{ maxWidth: 340 }}
            aria-label={`Competency radar chart for ${studentName}`}
          >
            <RadarGrid />
            {prevValues && (
              <RadarPolygon
                values={prevValues}
                color="#38bdf8"
                opacity={0.08}
                strokeOpacity={0.35}
              />
            )}
            <RadarPolygon
              values={currentValues}
              color="#a78bfa"
              opacity={0.2}
              strokeOpacity={0.9}
            />
            <RadarLabels />
          </svg>
        </div>

        {/* Score breakdown */}
        <div className="lg:col-span-2 space-y-3">
          {/* Average badge */}
          <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 px-4 py-3 text-center">
            <p className="text-2xl font-bold text-purple-400">
              {avg.toFixed(1)}
              <span className="text-sm font-normal text-purple-400/60">/5</span>
            </p>
            <p className="text-[10px] uppercase tracking-widest text-purple-400/60 mt-0.5">
              Average Score · Term {activeTerm}
            </p>
          </div>

          {/* Per-domain bars */}
          <div className="space-y-2">
            {COMPETENCY_DOMAINS.map((domain, i) => {
              const val = currentValues[i]!;
              const prevVal = prevValues?.[i] ?? null;
              const pct = (val / LEVELS) * 100;
              const delta = prevVal !== null ? val - prevVal : null;

              return (
                <div key={domain.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/60 flex items-center gap-1.5">
                      <span>{domain.icon}</span>
                      <span>{domain.label}</span>
                    </span>
                    <div className="flex items-center gap-1.5">
                      {delta !== null && delta !== 0 && (
                        <span
                          className={`text-[9px] font-bold ${delta > 0 ? "text-emerald-400" : "text-rose-400"}`}
                        >
                          {delta > 0 ? "▲" : "▼"}
                          {Math.abs(delta)}
                        </span>
                      )}
                      <span className="text-xs font-bold text-white tabular-nums">
                        {val}/5
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: domain.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend for compare mode */}
          {compareMode && prev && (
            <div className="flex items-center gap-4 pt-2 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-purple-400 inline-block rounded" />
                Term {activeTerm}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-sky-400 inline-block rounded opacity-50" />
                Term {activeTerm - 1}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
