"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, Star, User } from "lucide-react";
import type {
  CbcScore,
  ChildDashboardProps,
  ChildSwitcherProps,
  ParentHomeClientProps,
  ScoreBadgeProps,
} from "@/lib/types/parent";
import {
  CBC_SCORES,
  getInitials,
  getAvatarColor,
  getOverallLevel,
  getSubjectSummary,
  calcAge,
} from "@/lib/helpers/parent";

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: ScoreBadgeProps) {
  const meta = CBC_SCORES[score];
  return (
    <span
      className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold border ${meta.bg} ${meta.color} ${meta.border}`}
    >
      {score}
    </span>
  );
}

// ── Child switcher pill row ───────────────────────────────────────────────────

function ChildSwitcher({ children, activeId, onSelect }: ChildSwitcherProps) {
  if (children.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {children.map((child) => {
        const isActive = child.id === activeId;
        const initials = getInitials(child.full_name);
        const color = getAvatarColor(child.full_name);
        const firstName = child.full_name.split(" ")[0] ?? child.full_name;

        return (
          <button
            key={child.id}
            onClick={() => onSelect(child.id)}
            className={`flex items-center gap-2 flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 border ${
              isActive
                ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-200"
                : "bg-white text-stone-500 border-stone-200 hover:border-amber-300 hover:text-amber-700"
            }`}
          >
            <div
              className={`h-6 w-6 rounded-full bg-gradient-to-br ${color} flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0`}
            >
              {initials}
            </div>
            {firstName}
          </button>
        );
      })}
    </div>
  );
}

// ── Single child dashboard ────────────────────────────────────────────────────

function ChildDashboard({ child }: ChildDashboardProps) {
  const initials = getInitials(child.full_name);
  const avatarColor = getAvatarColor(child.full_name);
  const overall = getOverallLevel(child.assessments);
  const subjects = getSubjectSummary(child.assessments);
  const age = calcAge(child.date_of_birth);

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Hero card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 p-6 text-white shadow-xl shadow-amber-200">
        <div className="absolute -top-8 -right-8 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-white/10" />

        <div className="relative flex items-start gap-4">
          <div
            className={`h-16 w-16 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-xl font-bold text-white shadow-lg ring-4 ring-white/30 flex-shrink-0`}
          >
            {initials}
          </div>
          <div>
            <h2 className="text-xl font-bold leading-tight">
              {child.full_name}
            </h2>
            <p className="text-amber-100 text-sm mt-0.5">
              {child.current_grade} · Age {age}
            </p>
            <p className="font-mono text-xs text-amber-200 mt-1">
              {child.readable_id ?? "ID pending"}
            </p>
          </div>
        </div>

        <div className="relative mt-5 flex items-center gap-3">
          <span className="text-2xl">{overall.emoji}</span>
          <div>
            <p className="text-xs text-amber-100 font-semibold uppercase tracking-wider">
              Overall Performance
            </p>
            <p className="font-bold text-white">{overall.label}</p>
          </div>
        </div>
      </div>

      {/* Quick action tiles */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href={`/parent/child/${child.id}`}
          className="flex items-center gap-3 rounded-2xl bg-white border border-stone-100 p-4 shadow-sm hover:shadow-md hover:border-amber-200 transition-all duration-200 group"
        >
          <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
            <User className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-stone-400 font-medium">View</p>
            <p className="text-sm font-bold text-stone-700">Profile</p>
          </div>
        </Link>

        <Link
          href={`/parent/child/${child.id}/progress`}
          className="flex items-center gap-3 rounded-2xl bg-white border border-stone-100 p-4 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all duration-200 group"
        >
          <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
            <Star className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-stone-400 font-medium">View</p>
            <p className="text-sm font-bold text-stone-700">Progress</p>
          </div>
        </Link>
      </div>

      {/* Subject snapshot */}
      {subjects.length > 0 ? (
        <div>
          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
            Subject Snapshot
          </h3>
          <div className="space-y-2">
            {subjects.map(({ subject, score }) => (
              <div
                key={subject}
                className="flex items-center justify-between rounded-2xl bg-white border border-stone-100 px-4 py-3 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-xl bg-stone-50 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-4 w-4 text-stone-400" />
                  </div>
                  <p className="text-sm font-semibold text-stone-700">
                    {subject}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <ScoreBadge score={score as CbcScore} />
                  <Link
                    href={`/parent/child/${child.id}/progress`}
                    className="text-stone-300 hover:text-amber-500 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-stone-100 p-8 text-center shadow-sm">
          <p className="text-4xl mb-3">📚</p>
          <p className="text-stone-500 font-medium text-sm">
            No assessments recorded yet
          </p>
          <p className="text-stone-400 text-xs mt-1">
            Check back after the first term assessment.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Page-level client component ───────────────────────────────────────────────

export function ParentHomeClient({
  children,
  parentName,
}: ParentHomeClientProps) {
  const [activeId, setActiveId] = useState<string>(children[0]?.id ?? "");

  const activeChild = children.find((c) => c.id === activeId) ?? children[0];
  const firstName = parentName.split(" ")[0] ?? parentName;

  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-8">
        <p className="text-6xl mb-4">👨‍👩‍👧</p>
        <h2 className="text-xl font-bold text-stone-700">
          No children linked yet
        </h2>
        <p className="text-stone-400 text-sm mt-2">
          Contact the school office to link your children to this account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-stone-400 text-sm font-medium">Welcome back,</p>
        <h1 className="text-2xl font-bold text-stone-800">{firstName} 👋</h1>
      </div>

      <ChildSwitcher
        children={children}
        activeId={activeId}
        onSelect={setActiveId}
      />

      {activeChild !== undefined && <ChildDashboard child={activeChild} />}
    </div>
  );
}
