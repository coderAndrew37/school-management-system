"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, History, ArrowRight } from "lucide-react";
import { getRoleAuditLog, type AuditLogEntry } from "@/lib/actions/role-management";
import type { StaffMember } from "@/lib/types/auth";
import { Avatar } from "./UI";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-KE", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function RoleChip({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-stone-300 text-xs font-mono">none</span>;
  return (
    <span className="inline-flex items-center rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-mono text-stone-700">
      {value.replace(/_/g, " ")}
    </span>
  );
}

function LogEntry({ entry }: { entry: AuditLogEntry }) {
  const prev = entry.previous_values as { base_role?: string; admin_role?: string };
  const next = entry.new_values as { base_role?: string; admin_role?: string };

  const prevLabel = [prev.base_role, prev.admin_role].filter(Boolean).join(" · ") || null;
  const nextLabel = [next.base_role, next.admin_role].filter(Boolean).join(" · ") || null;

  const actionColor: Record<string, string> = {
    role_assigned: "bg-green-400",
    role_revoked: "bg-orange-400",
    role_def_created: "bg-blue-400",
    role_def_updated: "bg-amber-400",
    role_def_deactivated: "bg-red-400",
  };
  const dot = actionColor[entry.action] ?? "bg-stone-300";

  return (
    <div className="flex gap-3 py-4 border-b border-stone-100 last:border-0">
      <div className="mt-1.5 flex flex-col items-center gap-1 shrink-0">
        <div className={`h-2 w-2 rounded-full ${dot}`} />
        <div className="flex-1 w-px bg-stone-100" />
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <RoleChip value={prevLabel} />
          <ArrowRight className="h-3 w-3 text-stone-400 shrink-0" />
          <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-100 px-1.5 py-0.5 text-xs font-mono text-amber-800 font-semibold">
            {nextLabel ?? "—"}
          </span>
        </div>
        {entry.reason && (
          <p className="text-xs text-stone-500 italic">&quot;{entry.reason}&quot;</p>
        )}
        <p className="text-xs text-stone-400">{formatDate(entry.created_at)}</p>
      </div>
    </div>
  );
}

interface AuditLogDrawerProps {
  user: StaffMember | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AuditLogDrawer({ user, isOpen, onClose }: AuditLogDrawerProps) {
  const [log, setLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Clear data when drawer is closed or no user
    if (!isOpen || !user) {
      setLog([]);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getRoleAuditLog(user.id);
        if (isMounted) setLog(data ?? []);
      } catch (error) {
        console.error("Failed to fetch audit log:", error);
        if (isMounted) setLog([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [isOpen, user]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-sm bg-white shadow-2xl shadow-stone-900/20 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-amber-600" />
                <div>
                  <h3 className="text-sm font-semibold text-stone-900">Role History</h3>
                  {user && <p className="text-xs text-stone-500 mt-0.5">{user.full_name}</p>}
                </div>
              </div>
              <button
              aria-label="Close audit log"
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* User card */}
            {user && (
              <div className="flex items-center gap-3 mx-5 mt-4 p-3 rounded-xl bg-stone-50 border border-stone-100">
                <Avatar id={user.id} name={user.full_name} src={user.avatar_url} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-stone-800 truncate">{user.full_name}</p>
                  <p className="text-xs text-stone-400 truncate">{user.email ?? "—"}</p>
                </div>
              </div>
            )}

            {/* Log entries */}
            <div className="flex-1 overflow-y-auto px-5 mt-4">
              {loading ? (
                <div className="py-10 flex flex-col items-center gap-3 text-stone-400">
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-xs">Loading history…</p>
                </div>
              ) : log.length === 0 ? (
                <div className="py-10 text-center">
                  <History className="h-8 w-8 text-stone-200 mx-auto mb-2" />
                  <p className="text-sm text-stone-400">No role changes recorded yet</p>
                </div>
              ) : (
                log.map((entry) => <LogEntry key={entry.id} entry={entry} />)
              )}
            </div>

            <div className="px-5 py-4 border-t border-stone-100">
              <p className="text-xs text-stone-400 text-center">
                Showing last {log.length} change{log.length !== 1 ? "s" : ""}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}