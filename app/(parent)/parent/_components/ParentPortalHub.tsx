"use client";

import {
  BarChart2,
  Bell,
  BookOpen,
  Calendar,
  Compass,
  Image,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";

import type { ChildPortalData } from "@/lib/data/parent";
import type { Student } from "@/lib/types/dashboard";
import { AttendancePanel } from "./AttendancePanel";
import { CommunicationBook } from "./CommunicationBook";
import { CompetencyRadar } from "./CompetencyRadar";
import { DiaryView } from "./DiaryView";
import { JssPathwayPanel } from "./JSSPathwayPanel";
import { NotificationsPanel } from "./NotificationsPanel";
import { TalentGallery } from "./TalentGallery";

// ── Tab config ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "diary", label: "Diary", icon: BookOpen },
  { id: "attendance", label: "Attendance", icon: Calendar },
  { id: "communication", label: "Messages", icon: MessageSquare },
  { id: "competencies", label: "Competencies", icon: BarChart2 },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "pathway", label: "Pathway", icon: Compass },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_COLORS: Record<TabId, string> = {
  notifications: "text-sky-400 border-sky-400/30 bg-sky-400/10",
  diary: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  attendance: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10",
  communication: "text-purple-400 border-purple-400/30 bg-purple-400/10",
  competencies: "text-pink-400 border-pink-400/30 bg-pink-400/10",
  gallery: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  pathway: "text-indigo-400 border-indigo-400/30 bg-indigo-400/10",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  child: Student;
  data: ChildPortalData;
  senderRole: "parent" | "teacher" | "admin";
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ParentPortalHub({ child, data, senderRole }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("notifications");

  const unreadNotifs = data.notifications.filter((n) => !n.is_read).length;
  const unreadMsgs = data.messages.filter(
    (m) => !m.is_read && m.sender_role !== senderRole,
  ).length;
  const homeworkDue = data.diary.filter(
    (e) =>
      e.homework &&
      e.due_date &&
      new Date(e.due_date + "T00:00:00") >= new Date() &&
      (new Date(e.due_date + "T00:00:00").getTime() - Date.now()) / 86400000 <=
        3,
  ).length;

  const BADGES: Partial<Record<TabId, number>> = {
    notifications: unreadNotifs,
    communication: unreadMsgs,
    diary: homeworkDue,
  };

  const activeColor = TAB_COLORS[activeTab];

  return (
    <div className="space-y-5">
      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1.5 w-max min-w-full sm:min-w-0">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            const badge = BADGES[id];
            const color = TAB_COLORS[id];
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={[
                  "relative flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all whitespace-nowrap",
                  isActive
                    ? `border ${color}`
                    : "text-white/40 hover:text-white",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {label}
                {badge && badge > 0 ? (
                  <span
                    className={`ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-sky-500 text-white"
                    }`}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Section header ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        {(() => {
          const tab = TABS.find((t) => t.id === activeTab)!;
          const Icon = tab.icon;
          return (
            <>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center border ${activeColor}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{tab.label}</p>
                <p className="text-[10px] text-white/30">
                  {child.full_name} · {child.current_grade}
                </p>
              </div>
            </>
          );
        })()}
      </div>

      {/* ── Panel ─────────────────────────────────────────────────────────── */}
      <div>
        {activeTab === "notifications" && (
          <NotificationsPanel
            notifications={data.notifications}
            studentId={child.id}
          />
        )}
        {activeTab === "diary" && <DiaryView entries={data.diary} />}
        {activeTab === "attendance" && (
          <AttendancePanel
            records={data.attendance}
            studentName={child.full_name}
          />
        )}
        {activeTab === "communication" && (
          <CommunicationBook
            messages={data.messages}
            studentId={child.id}
            senderRole={senderRole}
          />
        )}
        {activeTab === "competencies" && (
          <CompetencyRadar
            competencies={data.competencies}
            studentName={child.full_name}
          />
        )}
        {activeTab === "gallery" && (
          <TalentGallery items={data.gallery} studentName={child.full_name} />
        )}
        {activeTab === "pathway" && (
          <JssPathwayPanel
            pathway={data.pathway}
            studentId={child.id}
            studentName={child.full_name}
            grade={child.current_grade}
          />
        )}
      </div>
    </div>
  );
}
