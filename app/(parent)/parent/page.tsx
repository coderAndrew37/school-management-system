import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import type { ChildWithAssessments } from "@/lib/types/parent";
import { redirect } from "next/navigation";

import { UrgentAnnouncementBanner } from "./_components/UrgentAnnouncementBanner";
import { ParentPortalHeader } from "./_components/ParentPortalHeader";
import { ChildHeroCard } from "./_components/ChildHeroCard";
import { QuickNavTiles } from "./_components/QuickNavTiles";

import {
  LatestDiaryCard,
  RecentGradesCard,
  MessagesCard,
  GalleryCard,
} from "./_components/InfoGridCards";
import { FeeSummaryCard } from "./_components/FeeSummaryCard";
import { MyChildTodayWidget } from "./_components/ParentOverviewWidget";
import { SchoolNoticesStrip, UpcomingEventsStrip } from "./_components/NoticeandEvents";

export const metadata = { title: "Parent Portal | Kibali Academy" };
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function ParentDashboard({ searchParams }: PageProps) {
  // 1. Verify Session & Role
  const session = await getSession();
  if (!session || session.profile.role !== "parent") {
    redirect("/login");
  }

  // 2. Fetch Children linked to this specific parent email
  const parentEmail = session.user.email;
  if (!parentEmail) {
    redirect("/login");
  }

  const _sp = await searchParams;
  const children: ChildWithAssessments[] = await fetchMyChildren(parentEmail);

  // 3. Handle Empty State
  if (children.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-[#f5f6fa]">
        <p className="text-6xl mb-4">🎒</p>
        <p className="text-slate-800 font-black text-xl">No children linked</p>
        <p className="text-slate-500 text-sm mt-2 max-w-sm leading-relaxed">
          Contact the school office to link your child&apos;s enrolment record
          to this account ({parentEmail}).
        </p>
      </div>
    );
  }

  // 4. Identify Active Child (from URL or default to first child)
  const activeChild = children.find((c) => c.id === _sp?.child) ?? children[0]!;

  // 5. Fetch all specific data for the active child
  // Parameters: (studentId, classId, gradeLabel)
  const childData = await fetchAllChildData(
    activeChild.id,
    activeChild.class_id ?? "", // Ensure your fetchMyChildren query includes class_id
    activeChild.current_grade
  );

  // ── Attendance stats (this month) ─────────────────────────────────────────
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const thisMonthAttend = childData.attendance.filter((r) => {
    const d = new Date(r.date);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  });

  const presentCount = thisMonthAttend.filter(
    (r) => r.status === "Present" || r.status === "Late",
  ).length;

  const absentCount = thisMonthAttend.filter(
    (r) => r.status === "Absent",
  ).length;

  const attendRate =
    thisMonthAttend.length > 0
      ? Math.round((presentCount / thisMonthAttend.length) * 100)
      : null;

  const todayAttendanceStatus =
    childData.attendance.find((a) => a.date.slice(0, 10) === todayStr)
      ?.status ?? null;

  // ── Announcements & Events ──────────────────────────────────────────────────
  const urgentAnn = childData.announcements.filter(
    (a) => a.priority === "urgent",
  );

  const activeAnn = childData.announcements
    .filter((a) => !a.expires_at || new Date(a.expires_at) > now)
    .slice(0, 3);

  const upcomingEvents = childData.events
    .filter((e) => {
      const eventDate = new Date(e.start_date + "T00:00:00");
      const diff = eventDate.getTime() - new Date().setHours(0, 0, 0, 0);
      return diff >= 0 && diff <= 30 * 86400000;
    })
    .slice(0, 3);

  const firstName = session.profile.full_name?.split(" ")[0] ?? "Parent";

  return (
    <div className="min-h-screen bg-[#f5f6fa]">
      {urgentAnn[0] && (
        <UrgentAnnouncementBanner announcement={urgentAnn[0]} />
      )}

      <ParentPortalHeader
        firstName={firstName}
        activeChildId={activeChild.id}
        unreadCount={childData.unreadCount}
      >
        {children}
      </ParentPortalHeader>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <ChildHeroCard
          child={activeChild}
          todayAttendanceStatus={todayAttendanceStatus}
          stats={{ presentCount, absentCount, attendRate }}
        />

        <MyChildTodayWidget
          child={activeChild}
          attendance={childData.attendance}
          diary={childData.diary}
        />

        <QuickNavTiles
          diaryCount={childData.diary.length}
          unreadMessageCount={
            childData.messages.filter((m) => !m.is_read).length
          }
          galleryCount={childData.gallery.length}
          assessmentCount={activeChild.assessments.length}
        />

        {(activeAnn.length > 0 || upcomingEvents.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SchoolNoticesStrip announcements={activeAnn} />
            <UpcomingEventsStrip events={upcomingEvents} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LatestDiaryCard entry={childData.diary[0] ?? null} />
          <RecentGradesCard assessments={activeChild.assessments} />
          <MessagesCard messages={childData.messages} />
          <GalleryCard items={childData.gallery} />
        </div>

        <FeeSummaryCard payments={childData.feePayments} />

        <footer className="border-t border-slate-200 pt-5 text-center pb-6">
          <p className="text-xs text-slate-400 font-medium">
            Kibali Academy Parent Portal · admin@kibali.ac.ke
          </p>
        </footer>
      </main>
    </div>
  );
}