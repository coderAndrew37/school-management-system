// app/teacher/conduct/components/ConductStats.tsx
// Four summary cards: Net Points, Merits, Demerits, Open Incidents.
// Purely presentational — receives pre-computed counts as props.

interface Props {
  totalPoints: number;
  meritCount: number;
  demeritCount: number;
  incidentCount: number;
}

export function ConductStats({
  totalPoints,
  meritCount,
  demeritCount,
  incidentCount,
}: Props) {
  const cards = [
    {
      label: "Net Points",
      value: totalPoints >= 0 ? `+${totalPoints}` : `${totalPoints}`,
      cls: totalPoints >= 0 ? "text-emerald-600" : "text-rose-600",
    },
    { label: "Merits", value: meritCount, cls: "text-emerald-600" },
    { label: "Demerits", value: demeritCount, cls: "text-amber-600" },
    {
      label: "Open Incidents",
      value: incidentCount,
      cls: incidentCount > 0 ? "text-rose-600" : "text-slate-400",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map(({ label, value, cls }) => (
        <div
          key={label}
          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm text-center"
        >
          <p className={`text-3xl font-black ${cls}`}>{value}</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-1">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}
