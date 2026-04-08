"use client";

import { useState, useRef } from "react";
import {
  Megaphone,
  CalendarDays,
  Package,
  Banknote,
  CalendarCheck,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { getAttendanceOverviewAction } from "@/lib/actions/governance";
import type {
  Announcement,
  SchoolEvent,
  InventoryItem,
  FeeStructure,
  FeePayment,
  StudentSummary,
  AttendanceOverview,
} from "@/lib/types/governance";
import type { Class } from "@/lib/types/allocation";

import { AnnouncementsPanel } from "./AnnouncementsPanel";
import { AttendanceOverviewPanel } from "./AttendanceOverviewPanel";
import { CalendarPanel } from "./CalendarPanel";
import { FeesPanel } from "./FeesPanel";
import { InventoryPanel } from "./InventoryPanel";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "announcements" | "calendar" | "attendance" | "inventory" | "fees";

export interface GovernanceHubProps {
  announcements: Announcement[];
  events: SchoolEvent[];
  inventory: InventoryItem[];
  feeStructures: FeeStructure[];
  payments: FeePayment[];
  students: StudentSummary[];
  attendanceOverview: AttendanceOverview;
  /** Added availableClasses to satisfy AnnouncementsPanel requirements */
  availableClasses: Class[];
}

const TABS: {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  activeClass: string;
  countFn: (p: GovernanceHubProps) => number;
  alertFn?: (p: GovernanceHubProps) => boolean;
}[] = [
  {
    id: "announcements",
    label: "Announcements",
    icon: <Megaphone className="h-4 w-4" />,
    activeClass: "border-amber-400 text-amber-400 bg-amber-400/10",
    countFn: (p) => p.announcements.length,
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: <CalendarDays className="h-4 w-4" />,
    activeClass: "border-sky-400 text-sky-400 bg-sky-400/10",
    countFn: (p) => p.events.length,
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: <CalendarCheck className="h-4 w-4" />,
    activeClass: "border-emerald-400 text-emerald-400 bg-emerald-400/10",
    countFn: (p) => p.attendanceOverview.totalMarked,
    alertFn: (p) => p.attendanceOverview.absent > 0,
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: <Package className="h-4 w-4" />,
    activeClass: "border-violet-400 text-violet-400 bg-violet-400/10",
    countFn: (p) => p.inventory.length,
    alertFn: (p) => p.inventory.some((i) => i.quantity <= i.minimum_stock),
  },
  {
    id: "fees",
    label: "Fees",
    icon: <Banknote className="h-4 w-4" />,
    activeClass: "border-rose-400 text-rose-400 bg-rose-400/10",
    countFn: (p) => p.payments.length,
    alertFn: (p) =>
      p.payments.some((p) =>
        ["pending", "partial", "overdue"].includes(p.status),
      ),
  },
];

const INACTIVE =
  "border-transparent text-white/40 hover:text-white/70 hover:bg-white/[0.04]";

// ── Component ─────────────────────────────────────────────────────────────────

export function GovernanceHub(props: GovernanceHubProps) {
  const [activeTab, setActiveTab] = useState<Tab>("announcements");
  const tabListRef = useRef<HTMLDivElement>(null);

  /**
   * Keyboard navigation for accessibility (Left/Right arrows)
   */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab);
    if (e.key === "ArrowRight") {
      const nextIndex = (currentIndex + 1) % TABS.length;
      setActiveTab(TABS[nextIndex].id);
      (
        e.currentTarget.querySelectorAll('[role="tab"]')[
          nextIndex
        ] as HTMLElement
      ).focus();
    } else if (e.key === "ArrowLeft") {
      const prevIndex = (currentIndex - 1 + TABS.length) % TABS.length;
      setActiveTab(TABS[prevIndex].id);
      (
        e.currentTarget.querySelectorAll('[role="tab"]')[
          prevIndex
        ] as HTMLElement
      ).focus();
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      {/* Tab bar */}
      <div
        ref={tabListRef}
        role="tablist"
        aria-label="School governance sections"
        onKeyDown={handleKeyDown}
        className="flex items-stretch border-b border-white/[0.07] overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: "none" }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tab.countFn(props);
          const hasAlert = tab.alertFn?.(props) ?? false;

          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-5 py-4 text-sm font-semibold transition-colors",
                "border-b-2 whitespace-nowrap flex-shrink-0",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400/60",
                isActive ? tab.activeClass : INACTIVE,
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>

              {count > 0 && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums",
                    isActive ? "bg-white/15" : "bg-white/[0.08] text-white/30",
                  )}
                >
                  {count}
                </span>
              )}

              {hasAlert && (
                <span className="absolute top-2.5 right-2 h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="p-6 focus:outline-none"
        tabIndex={0}
      >
        {activeTab === "announcements" && (
          <AnnouncementsPanel 
            announcements={props.announcements} 
            availableClasses={props.availableClasses}
          />
        )}
        {activeTab === "calendar" && <CalendarPanel events={props.events} />}
        {activeTab === "attendance" && (
          <AttendanceOverviewPanel
            initial={props.attendanceOverview}
            fetchFn={getAttendanceOverviewAction}
          />
        )}
        {activeTab === "inventory" && (
          <InventoryPanel items={props.inventory} />
        )}
        {activeTab === "fees" && (
          <FeesPanel
    feeStructures={props.feeStructures}
    payments={props.payments}
    students={props.students}
    classes={props.availableClasses} // Add this line
  />
        )}
      </div>
    </div>
  );
}