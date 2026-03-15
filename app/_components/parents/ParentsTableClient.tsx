"use client";

// app/admin/parents/_components/ParentsTableClient.tsx
// Thin orchestration layer — owns filter state, export, and drawer open/close.
// Heavy logic lives in ParentEditDrawer; atoms in ParentAtoms; utils in parent-utils.

import { DataTable, type ColumnDef } from "@/app/_components/shared/DataTable";
import { fetchParentsForExport } from "@/lib/actions/parents";
import type { Parent } from "@/lib/types/dashboard";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock, Download, Loader2, Pencil } from "lucide-react";
import { useState, useTransition } from "react";
import { ParentAvatar, Toast } from "./ParentAtoms";
import { ParentEditDrawer } from "./ParentEditDrawer";
import { exportParentsToCSV, fmt } from "./parent-utils";

// ── Column definitions ────────────────────────────────────────────────────────

function useColumns(onManage: (p: Parent) => void): ColumnDef<Parent>[] {
  return [
    {
      key: "full_name",
      label: "Parent / Guardian",
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-3">
          <ParentAvatar name={p.full_name} />
          <div className="min-w-0">
            <p className="font-medium text-white truncate">{p.full_name}</p>
            <p className="text-xs text-white/35 font-mono truncate max-w-[160px]">
              {p.phone_number ?? "—"}
            </p>
          </div>
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
          className="text-xs text-white/50 hover:text-amber-400 transition-colors underline-offset-4 hover:underline"
        >
          {p.email}
        </a>
      ),
    },
    {
      key: "children_count",
      label: "Children",
      sortable: true,
      sortValue: (p) => p.children.length,
      render: (p) => (
        <div className="flex items-center gap-1.5">
          <span className="text-white/70 text-sm font-semibold">
            {p.children.length}
          </span>
          <span className="text-white/30 text-xs">
            {p.children.map((c) => c.full_name.split(" ")[0]).join(", ")}
          </span>
        </div>
      ),
    },
    {
      key: "invite_accepted",
      label: "Portal Status",
      sortable: true,
      sortValue: (p) => (p.invite_accepted ? 1 : 0),
      render: (p) =>
        p.invite_accepted ? (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> Active
          </span>
        ) : (
          <div>
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400">
              <Clock className="h-3.5 w-3.5" /> Pending
            </span>
            {p.last_invite_sent && (
              <p className="text-[9px] text-white/25 mt-0.5">
                Sent {formatDistanceToNow(new Date(p.last_invite_sent))} ago
              </p>
            )}
          </div>
        ),
    },
    {
      key: "created_at",
      label: "Registered",
      sortable: true,
      sortValue: (p) => new Date(p.created_at).getTime(),
      render: (p) => (
        <span className="text-xs text-white/35">{fmt(p.created_at)}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (p) => (
        <button
          aria-label={`Manage ${p.full_name}`}
          onClick={() => onManage(p)}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/50 hover:text-white hover:bg-white/[0.08] transition-all"
        >
          <Pencil className="h-3 w-3" /> Manage
        </button>
      ),
    },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  parents: Parent[];
}

export function ParentsTableClient({ parents }: Props) {
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "pending"
  >("all");
  const [editParent, setEditParent] = useState<Parent | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [exporting, setExporting] = useState(false);
  const [, startTransition] = useTransition();

  const columns = useColumns(setEditParent);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleExport() {
    setExporting(true);
    const res = await fetchParentsForExport();
    setExporting(false);
    if (res.success) exportParentsToCSV(res.data);
    else showToast("error", res.message ?? "Export failed.");
  }

  const counts = {
    all: parents.length,
    active: parents.filter((p) => p.invite_accepted).length,
    pending: parents.filter((p) => !p.invite_accepted).length,
  };

  const visible =
    statusFilter === "active"
      ? parents.filter((p) => p.invite_accepted)
      : statusFilter === "pending"
        ? parents.filter((p) => !p.invite_accepted)
        : parents;

  return (
    <div className="space-y-4">
      {/* Status tabs + export */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-1">
          {(["all", "active", "pending"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setStatusFilter(t)}
              className={[
                "flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all capitalize",
                statusFilter === t
                  ? "bg-amber-400/15 border border-amber-400/30 text-amber-400"
                  : "text-white/35 hover:text-white",
              ].join(" ")}
            >
              {t}
              <span className="rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[9px] font-bold text-white/40">
                {counts[t]}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-xs text-white/50 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          Export CSV
        </button>
      </div>

      <DataTable<Parent>
        rows={visible}
        columns={columns}
        rowKey="id"
        searchFields={[
          "full_name",
          "email",
          "phone_number",
          (p) => p.children.map((c) => c.full_name).join(" "),
        ]}
        searchPlaceholder="Search by name, email, phone or child…"
        defaultSortKey="full_name"
        defaultSortDir="asc"
        emptyIcon="👪"
        emptyMessage="No parents registered yet"
      />

      {editParent && (
        <ParentEditDrawer
          parent={editParent}
          onClose={() => setEditParent(null)}
          onToast={showToast}
        />
      )}

      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
}
