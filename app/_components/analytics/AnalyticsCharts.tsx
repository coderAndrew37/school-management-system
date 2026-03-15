"use client";

// app/_components/analytics/AnalyticsCharts.tsx
// Reusable CSS-native chart primitives.
// No external chart library — all layout is pure CSS / inline styles / SVG.

// ── Score bar (horizontal stacked) ───────────────────────────────────────────

export function ScoreBar({
  ee,
  me,
  ae,
  be,
  h = "h-2",
}: {
  ee: number;
  me: number;
  ae: number;
  be: number;
  h?: string;
}) {
  const total = ee + me + ae + be;
  if (total === 0)
    return <div className={`${h} rounded-full bg-white/5 w-full`} />;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  return (
    <div className={`flex ${h} rounded-full overflow-hidden w-full gap-px`}>
      {ee > 0 && (
        <div
          className="bg-emerald-400 rounded-l-full"
          style={{ width: pct(ee) }}
        />
      )}
      {me > 0 && <div className="bg-sky-400" style={{ width: pct(me) }} />}
      {ae > 0 && <div className="bg-amber-400" style={{ width: pct(ae) }} />}
      {be > 0 && (
        <div
          className="bg-rose-400 rounded-r-full"
          style={{ width: pct(be) }}
        />
      )}
    </div>
  );
}

// ── Horizontal bar (single value as % of max) ─────────────────────────────────

export function HBar({
  value,
  max,
  color = "bg-amber-400",
  label,
  sublabel,
  right,
}: {
  value: number;
  max: number;
  color?: string;
  label: string;
  sublabel?: string;
  right: React.ReactNode;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-white truncate">{label}</p>
        <div className="shrink-0 ml-2">{right}</div>
      </div>
      {sublabel && <p className="text-[10px] text-white/30">{sublabel}</p>}
      <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Vertical bar (for enrollment chart) ──────────────────────────────────────

export function VBar({
  value,
  max,
  color,
  label,
}: {
  value: number;
  max: number;
  color: string;
  label: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <p className="text-[10px] font-bold text-white/60">{value}</p>
      <div
        className="w-8 bg-white/[0.06] rounded-t-md overflow-hidden"
        style={{ height: 80 }}
      >
        <div
          className={`w-full ${color} rounded-t-md transition-all duration-700`}
          style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
        />
      </div>
      <p
        className="text-[9px] text-white/40 text-center leading-tight max-w-[48px] truncate"
        title={label}
      >
        {label.replace("Grade ", "G").replace(" / JSS", "")}
      </p>
    </div>
  );
}

// ── Donut chart (conic-gradient) ──────────────────────────────────────────────

export function Donut({
  segments,
  size = 120,
  label,
  sublabel,
}: {
  segments: { value: number; color: string }[];
  size?: number;
  label: string;
  sublabel?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0)
    return (
      <div
        className="rounded-full bg-white/5 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <p className="text-xs text-white/20">No data</p>
      </div>
    );
  let cursor = 0;
  const stops = segments.map((s) => {
    const deg = (s.value / total) * 360;
    const start = cursor;
    cursor += deg;
    return `${s.color} ${start}deg ${cursor}deg`;
  });
  const inner = Math.round(size * 0.6);
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${stops.join(", ")})`,
        }}
      />
      <div
        className="absolute rounded-full bg-[#0c0f1a] flex flex-col items-center justify-center"
        style={{ width: inner, height: inner }}
      >
        <p className="text-sm font-bold text-white leading-tight">{label}</p>
        {sublabel && <p className="text-[9px] text-white/40">{sublabel}</p>}
      </div>
    </div>
  );
}

// ── Sparkline (SVG polyline) ──────────────────────────────────────────────────

export function Sparkline({
  values,
  color = "#f59e0b",
  height = 40,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  if (values.length < 2 || values.every((v) => v === 0))
    return (
      <div
        className="flex items-center justify-center text-[10px] text-white/20"
        style={{ height }}
      >
        No data
      </div>
    );
  const w = 200;
  const max = Math.max(...values, 1);
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = height - (v / max) * height * 0.85 - height * 0.05;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = height - (v / max) * height * 0.85 - height * 0.05;
        return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
      })}
    </svg>
  );
}
