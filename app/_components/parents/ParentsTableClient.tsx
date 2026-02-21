"use client";

import { Parent } from "@/lib/types/dashboard";
import { DataTable, ColumnDef } from "@/app/_components/shared/DataTable";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock } from "lucide-react";
import { ResendInviteButton } from "./ResendEmailButton";

// ── Helpers ────────────────────────────────────────────────────────────────────

// function formatDate(dt: string): string {
//   return new Date(dt).toLocaleDateString("en-KE", {
//     day: "numeric",
//     month: "short",
//     year: "numeric",
//   });
// }

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
          className={`shrink-0 h-8 w-8 rounded-lg bg-linear-to-br ${getAvatarColor(p.full_name)} flex items-center justify-center text-xs font-bold text-white shadow-sm`}
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
    key: "invite_accepted",
    label: "Portal Status",
    sortable: true,
    render: (p) =>
      p.invite_accepted ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3" />
            Active
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-amber-500/80 text-[10px] font-bold uppercase tracking-wider">
            <Clock className="h-3 w-3" />
            Pending
          </div>
          {p.last_invite_sent && (
            <span className="text-[10px] text-white/20">
              Sent {formatDistanceToNow(new Date(p.last_invite_sent))} ago
            </span>
          )}
        </div>
      ),
  },
  {
    key: "actions",
    label: "Actions",
    render: (p) => (
      <div className="flex items-center gap-2">
        {!p.invite_accepted && (
          <ResendInviteButton parentId={p.id} parentEmail={p.email} />
        )}
      </div>
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
