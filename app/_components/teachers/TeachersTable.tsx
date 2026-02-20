"use client";

import { ColumnDef, DataTable } from "@/app/_components/shared/DataTable";
import { Teacher } from "@/lib/types/dashboard";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Formats ISO date strings to Kenyan locale.
 */
function formatDate(dt: string): string {
  return new Date(dt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Extracts initials for the avatar.
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const avatarColors = [
  "from-emerald-400 to-teal-500",
  "from-sky-400 to-blue-500",
  "from-violet-400 to-purple-500",
  "from-amber-400 to-orange-500",
  "from-cyan-400 to-blue-400",
  "from-rose-400 to-pink-500",
];

/**
 * Returns a consistent gradient based on the teacher's name.
 */
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length]!;
}

// ── Columns ────────────────────────────────────────────────────────────────────

const columns: ColumnDef<Teacher>[] = [
  {
    key: "full_name",
    label: "Teacher",
    sortable: true,
    render: (t) => (
      <div className="flex items-center gap-3">
        <div
          className={`flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br ${getAvatarColor(t.full_name)} flex items-center justify-center text-xs font-bold text-white shadow-sm`}
        >
          {getInitials(t.full_name)}
        </div>
        <span className="font-medium text-white">{t.full_name}</span>
      </div>
    ),
  },
  {
    key: "tsc_number",
    label: "TSC No.",
    sortable: true,
    render: (t) =>
      t.tsc_number ? (
        <span className="font-mono text-xs text-emerald-400/80">
          {t.tsc_number}
        </span>
      ) : (
        <span className="text-white/25 text-xs italic">Pending</span>
      ),
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    render: (t) => (
      <a
        href={`mailto:${t.email}`}
        className="text-white/60 text-xs hover:text-amber-400 transition-colors duration-150 underline-offset-4 hover:underline"
      >
        {t.email}
      </a>
    ),
  },
  {
    key: "phone_number",
    label: "Phone",
    render: (t) =>
      t.phone_number ? (
        <a
          href={`tel:${t.phone_number}`}
          className="font-mono text-xs text-white/50 hover:text-white/80 transition-colors duration-150"
        >
          {t.phone_number}
        </a>
      ) : (
        <span className="text-white/25">—</span>
      ),
  },
  {
    key: "created_at",
    label: "Joined",
    sortable: true,
    sortValue: (t) => new Date(t.created_at).getTime(),
    render: (t) => (
      <span className="text-white/30 text-xs">{formatDate(t.created_at)}</span>
    ),
  },
];

// ── Client component ───────────────────────────────────────────────────────────

interface TeachersTableClientProps {
  teachers: Teacher[];
}

export function TeachersTableClient({ teachers }: TeachersTableClientProps) {
  return (
    <DataTable<Teacher>
      rows={teachers}
      columns={columns}
      rowKey="id"
      searchFields={["full_name", "email", "tsc_number", "phone_number"]}
      searchPlaceholder="Search by name, email or TSC number…"
      defaultSortKey="full_name"
      defaultSortDir="asc"
      emptyIcon="📋"
      emptyMessage="No teachers registered yet"
    />
  );
}
