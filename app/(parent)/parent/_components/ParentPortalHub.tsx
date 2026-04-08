"use client";

import {
  BarChart2,
  Bell,
  BookOpen,
  Calendar,
  CalendarDays,
  Compass,
  CreditCard,
  Image,
  Megaphone,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";

import type { ChildPortalData } from "@/lib/data/parent";
import type { Student } from "@/lib/types/dashboard";
import { AnnouncementsView } from "./AnnouncementsView";
import { AttendancePanel } from "./AttendancePanel";
import { CommunicationBook } from "./CommunicationBook";
import { CompetencyRadar } from "./CompetencyRadar";
import { DiaryView } from "./DiaryView";
import { FeeStatusPanel } from "./FeesStatusPanel";
import { JssPathwayPanel } from "./JSSPathwayPanel";
import { NotificationsPanel } from "./NotificationsPanel";
import { SchoolCalendarView } from "./SchoolCalendarView";
import { TalentGallery } from "./TalentGallery";

// ── Tab config ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "notifications", label: "Alerts", icon: Bell },
  { id: "announcements", label: "Notices", icon: Megaphone },
  { id: "diary", label: "Diary", icon: BookOpen },
  { id: "attendance", label: "Attendance", icon: Calendar },
  { id: "communication", label: "Messages", icon: MessageSquare },
  { id: "fees", label: "Fees", icon: CreditCard },
  { id: "events", label: "Events", icon: CalendarDays },
  { id: "competencies", label: "Skills", icon: BarChart2 },
  { id: "gallery", label: "Gallery", icon: Image },
  { id: "pathway", label: "Pathway", icon: Compass },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_ACCENT: Record<
  TabId,
  { icon: string; bg: string; border: string; text: string }
> = {
  notifications: {
    icon: "bg-blue-100",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
  },
  announcements: {
    icon: "bg-amber-100",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  diary: {
    icon: "bg-amber-100",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  attendance: {
    icon: "bg-emerald-100",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  communication: {
    icon: "bg-purple-100",
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
  },
  fees: {
    icon: "bg-red-100",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
  },
  events: {
    icon: "bg-cyan-100",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-700",
  },
  competencies: {
    icon: "bg-pink-100",
    bg: "bg-pink-50",
    border: "border-pink-200",
    text: "text-pink-700",
  },
  gallery: {
    icon: "bg-orange-100",
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
  },
  pathway: {
    icon: "bg-indigo-100",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
  },
};

interface Props {
  child: Student;
  data: ChildPortalData;
  senderRole: "parent" | "teacher" | "admin";
}

export function ParentPortalHub({ child, data, senderRole }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("notifications");

  const now = new Date();
  const todayAtMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  // ── Badges ────────────────────────────────────────────────────────────────
  const unreadNotifs = data.notifications.filter((n) => !n.is_read).length;

  const unreadMsgs = data.messages.filter(
    (m) => !m.is_read && m.sender_role !== senderRole,
  ).length;

  const homeworkDue = data.diary.filter((e) => {
    const isHw = e.entry_type === "homework";
    if (!isHw || !e.due_date) return false;

    const dueDate = new Date(e.due_date + "T00:00:00").getTime();
    const diffDays = (dueDate - todayAtMidnight) / 86400000;
    
    return dueDate >= todayAtMidnight && diffDays <= 3;
  }).length;

  const urgentAnnouncements = (data.announcements ?? []).filter((a) => {
    if (a.expires_at && new Date(a.expires_at) < now) return false;
    if (a.audience === "teachers") return false;
    if (a.audience === "grade" && a.target_class_id !== child.class_id)
      return false;
      
    return a.priority === "urgent" || a.priority === "high";
  }).length;

  const feeArrears = (data.feePayments ?? []).filter((p) =>
    ["overdue", "partial", "pending"].includes(p.status),
  ).length;

  const soonEvents = (data.events ?? []).filter((e) => {
    const eventTime = new Date(e.start_date + "T00:00:00").getTime();
    const diff = (eventTime - now.getTime()) / 86400000;
    return diff >= 0 && diff <= 7;
  }).length;

  const BADGES: Partial<Record<TabId, number>> = {
    notifications: unreadNotifs,
    announcements: urgentAnnouncements,
    communication: unreadMsgs,
    diary: homeworkDue,
    fees: feeArrears,
    events: soonEvents,
  };

  const accent = TAB_ACCENT[activeTab];
  const activeTab_ = TABS.find((t) => t.id === activeTab)!;
  const ActiveIcon = activeTab_.icon;

  return (
    <div className="space-y-4">
      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 w-max min-w-full sm:min-w-0 shadow-sm">
          {TABS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            const badge = BADGES[id];
            const ac = TAB_ACCENT[id];
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={[
                  "relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all whitespace-nowrap",
                  isActive
                    ? `${ac.bg} ${ac.text} border ${ac.border} shadow-sm`
                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-50",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                {label}
                {badge && badge > 0 ? (
                  <span
                    className={`ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black ${
                      isActive
                        ? "bg-white/70 text-inherit"
                        : "bg-red-500 text-white"
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

      {/* ── Section header ───────────────────────────────────────────────────── */}
      <div
        className={`flex items-center gap-3 rounded-xl border ${accent.border} ${accent.bg} px-4 py-3`}
      >
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-xl ${accent.icon} ${accent.text}`}
        >
          <ActiveIcon className="h-4 w-4" />
        </div>
        <div>
          <p className={`text-sm font-black ${accent.text}`}>
            {activeTab_.label}
          </p>
          <p className="text-[10px] font-semibold text-slate-400">
            {child.full_name} · {child.current_grade}
          </p>
        </div>
      </div>

      {/* ── Content panel ────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
        {activeTab === "announcements" && child.class_id && (
          <AnnouncementsView
            announcements={data.announcements ?? []}
            childClassId={child.class_id}
          />
        )}
        {activeTab === "events" && child.class_id && (
          <SchoolCalendarView
            events={data.events ?? []}
            childClassId={child.class_id}
            childGradeLabel={child.current_grade}
          />
        )}
        {activeTab === "fees" && (
          <FeeStatusPanel
            payments={data.feePayments ?? []}
            childName={child.full_name}
          />
        )}
      </div>
    </div>
  );
}