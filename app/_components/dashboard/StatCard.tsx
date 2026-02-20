import Link from "next/link";

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  accent: "amber" | "sky" | "emerald";
  link: string;
}

const accentMap = {
  amber: {
    border: "border-amber-400/20",
    bg: "bg-amber-400/10",
    text: "text-amber-400",
    glow: "shadow-amber-400/10",
  },
  sky: {
    border: "border-sky-400/20",
    bg: "bg-sky-400/10",
    text: "text-sky-400",
    glow: "shadow-sky-400/10",
  },
  emerald: {
    border: "border-emerald-400/20",
    bg: "bg-emerald-400/10",
    text: "text-emerald-400",
    glow: "shadow-emerald-400/10",
  },
};

export function StatCard({ label, value, icon, accent, link }: StatCardProps) {
  const styles = accentMap[accent];

  return (
    <Link href={link}>
      <div
        className={`rounded-2xl border ${styles.border} bg-white/[0.04] backdrop-blur-sm p-5 shadow-lg ${styles.glow}`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">
              {label}
            </p>
            <p className={`text-4xl font-bold tabular-nums ${styles.text}`}>
              {value.toLocaleString()}
            </p>
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles.bg} border ${styles.border} text-xl`}
          >
            {icon}
          </div>
        </div>
      </div>
    </Link>
  );
}
