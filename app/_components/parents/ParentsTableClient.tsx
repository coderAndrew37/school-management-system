"use client";

import { Parent } from "@/lib/types/dashboard";
import { DataTable, ColumnDef } from "@/app/_components/shared/DataTable";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Formats date strings to a consistent Kenyan locale format.
 */
function formatDate(dt: string): string {
  return new Date(dt).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Extracts initials from the full name (max 2 characters).
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
  "from-sky-400 to-blue-500",
  "from-amber-400 to-orange-500",
  "from-violet-400 to-purple-500",
  "from-emerald-400 to-teal-500",
  "from-rose-400 to-pink-500",
  "from-cyan-400 to-blue-400",
];

/**
 * Generates a stable gradient color based on the string hash of the name.
 */
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return avatarColors[Math.abs(hash) % avatarColors.length]!;
}

// ── Columns ────────────────────────────────────────────────────────────────────

const columns: ColumnDef<Parent>[] = [
  {
    key: "full_name",
    label: "Parent / Guardian",
    sortable: true,
    render: (p) => (
      <div className="flex items-center gap-3">
        <div
          className={`flex-shrink-0 h-8 w-8 rounded-lg bg-gradient-to-br ${getAvatarColor(p.full_name)} flex items-center justify-center text-xs font-bold text-white shadow-sm`}
        >
          {getInitials(p.full_name)}
        </div>
        <span className="font-medium text-white">{p.full_name}</span>
      </div>
    ),
  },
  {
    key: "email",
    label: "Email",
    sortable: true,
    render: (p) => (
      <a
        href={`mailto:${p.email}`}
        className="text-white/60 text-xs hover:text-amber-400 transition-colors duration-150 underline-offset-4 hover:underline"
      >
        {p.email}
      </a>
    ),
  },
  {
    key: "phone_number",
    label: "Phone",
    sortable: true,
    render: (p) => (
      <a
        href={`tel:${p.phone_number}`}
        className="font-mono text-xs text-sky-400/70 hover:text-sky-400 transition-colors duration-150"
      >
        {p.phone_number}
      </a>
    ),
  },
  {
    key: "created_at",
    label: "Registered",
    sortable: true,
    // Forces sorting by timestamp instead of string alphabetical order
    sortValue: (p) => new Date(p.created_at).getTime(),
    render: (p) => (
      <span className="text-white/30 text-xs">{formatDate(p.created_at)}</span>
    ),
  },
];

// ── Client component ───────────────────────────────────────────────────────────

interface ParentsTableClientProps {
  parents: Parent[];
}

export function ParentsTableClient({ parents }: ParentsTableClientProps) {
  return (
    <DataTable<Parent>
      rows={parents}
      columns={columns}
      rowKey="id"
      searchFields={["full_name", "email", "phone_number"]}
      searchPlaceholder="Search by name, email or phone…"
      defaultSortKey="full_name"
      defaultSortDir="asc"
      emptyIcon="👪"
      emptyMessage="No parents registered yet"
    />
  );
}
