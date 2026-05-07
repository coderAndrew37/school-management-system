"use client";

/**
 * ParentPanel
 *
 * The collapsible parent / guardian section inside each student row.
 * Extracted from BulkAdmitStudentEditor to keep that file focused on
 * layout and state orchestration only.
 */

import type { BulkAdmitRow } from "@/lib/actions/bulk-admit";
import type { ParentSearchResult } from "@/lib/actions/admit";
import {
  AlertCircle,
  ChevronDown,
  Mail,
  Phone,
  User,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { RELATIONSHIP_OPTIONS } from "./types";
import { ParentSearch } from "./ParentSearch";

interface ParentPanelProps {
  rowIndex: number;
  row: BulkAdmitRow;
  selectedParent: ParentSearchResult | null;
  onRowChange: <K extends keyof BulkAdmitRow>(field: K, value: BulkAdmitRow[K]) => void;
  onSelectParent: (p: ParentSearchResult | null) => void;
}

export function ParentPanel({
  rowIndex,
  row,
  selectedParent,
  onRowChange,
  onSelectParent,
}: ParentPanelProps) {
  const panelId = `parent-panel-${rowIndex}`;
  const modeLabelId = `parent-mode-label-${rowIndex}`;

  return (
    <div
      id={panelId}
      role="region"
      aria-label={`Parent info for student ${rowIndex + 1}`}
      className="border-t border-white/[0.05] bg-white/[0.015] px-4 py-4"
    >
      <div className="ml-9 space-y-4">

        {/* ── Mode toggle + Relationship ── */}
        <div className="flex items-center gap-3 flex-wrap">
          <span
            id={modeLabelId}
            className="text-[10px] text-white/30 font-bold uppercase tracking-wider"
          >
            Parent:
          </span>

          <div
            className="flex bg-white/[0.04] rounded-lg border border-white/[0.06] p-0.5"
            role="group"
            aria-labelledby={modeLabelId}
          >
            <button
              type="button"
              onClick={() => {
                onRowChange("parentMode", "new");
                onSelectParent(null);
              }}
              aria-label="Add new parent"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                row.parentMode === "new"
                  ? "bg-amber-400 text-[#0c0f1a]"
                  : "text-white/35 hover:text-white/60"
              }`}
            >
              <UserPlus className="h-3 w-3" aria-hidden="true" /> New
            </button>
            <button
              type="button"
              onClick={() => onRowChange("parentMode", "existing")}
              aria-label="Link existing parent"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                row.parentMode === "existing"
                  ? "bg-amber-400 text-[#0c0f1a]"
                  : "text-white/35 hover:text-white/60"
              }`}
            >
              <UserCheck className="h-3 w-3" aria-hidden="true" /> Existing
            </button>
          </div>

          {/* Relationship */}
          <div className="flex items-center gap-2 ml-auto">
            <label
              htmlFor={`relationship-${rowIndex}`}
              className="text-[10px] text-white/30 font-medium uppercase tracking-wider"
            >
              Relationship:
            </label>
            <div className="relative">
              <select
                id={`relationship-${rowIndex}`}
                value={row.relationshipType}
                onChange={(e) =>
                  onRowChange(
                    "relationshipType",
                    e.target.value as BulkAdmitRow["relationshipType"]
                  )
                }
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white/70 appearance-none pr-6 focus:outline-none focus:border-amber-400/40 cursor-pointer"
              >
                {RELATIONSHIP_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/25"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>

        {/* ── Existing parent search ── */}
        {row.parentMode === "existing" && (
          <div className="space-y-2">
            <ParentSearch selected={selectedParent} onSelect={onSelectParent} />
            {!selectedParent && (
              <p className="text-[11px] text-white/25 flex items-center gap-1.5" role="note">
                <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
                Search by name, email or phone. Selecting links this student to their existing
                account.
              </p>
            )}
          </div>
        )}

        {/* ── New parent fields ── */}
        {row.parentMode === "new" && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Name */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`parent-name-${rowIndex}`}
                  className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex items-center gap-1"
                >
                  <User className="h-3 w-3" aria-hidden="true" /> Full Name *
                </label>
                <input
                  id={`parent-name-${rowIndex}`}
                  type="text"
                  placeholder="Parent / guardian name"
                  value={row.parentName ?? ""}
                  onChange={(e) => onRowChange("parentName", e.target.value)}
                  className="p-input w-full"
                  autoComplete="off"
                  aria-required="true"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`parent-email-${rowIndex}`}
                  className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex items-center gap-1"
                >
                  <Mail className="h-3 w-3" aria-hidden="true" /> Email Address *
                </label>
                <input
                  id={`parent-email-${rowIndex}`}
                  type="email"
                  placeholder="parent@email.com"
                  value={row.parentEmail ?? ""}
                  onChange={(e) => onRowChange("parentEmail", e.target.value)}
                  className="p-input w-full"
                  autoComplete="off"
                  aria-required="true"
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label
                  htmlFor={`parent-phone-${rowIndex}`}
                  className="text-[10px] text-white/30 font-bold uppercase tracking-wider flex items-center gap-1"
                >
                  <Phone className="h-3 w-3" aria-hidden="true" /> Phone Number *
                </label>
                <input
                  id={`parent-phone-${rowIndex}`}
                  type="tel"
                  placeholder="+254 7XX XXX XXX"
                  value={row.parentPhone ?? ""}
                  onChange={(e) => onRowChange("parentPhone", e.target.value)}
                  className="p-input w-full"
                  autoComplete="off"
                  aria-required="true"
                />
              </div>
            </div>

            <p className="text-[11px] text-white/20 flex items-center gap-1.5 leading-relaxed" role="note">
              <AlertCircle className="h-3 w-3 shrink-0 text-white/25" aria-hidden="true" />
              A welcome email with account setup link will be sent to the parent. If a parent
              with this email or phone already exists, the student is automatically linked — no
              duplicate created.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}