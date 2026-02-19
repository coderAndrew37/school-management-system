import Link from "next/link";
import {
  BookMarked,
  Calendar,
  LayoutDashboard,
  UserRoundPlus,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase/client";
import { fetchSubjects, fetchAllocations } from "@/lib/data/allocation";

import type { Teacher } from "@/lib/types/dashboard";
import { GenerateTimetableButton } from "../../_components/allocation/GenerateTimetableButton";
import { AllocationPanel } from "../../_components/allocation/AllocationPanel";

export const metadata = {
  title: "Subject Allocation | Kibera Academy",
};

export const revalidate = 60;

async function fetchTeachers(): Promise<Teacher[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("teachers")
    .select("id, full_name, email, tsc_number, phone_number, created_at")
    .order("full_name");
  if (error) return [];
  return (data ?? []) as Teacher[];
}

export default async function AllocationPage() {
  const [teachers, subjects, allocations] = await Promise.all([
    fetchTeachers(),
    fetchSubjects(),
    fetchAllocations(2026),
  ]);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      {/* Ambient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-amber-500/[0.04] blur-[130px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-500/[0.03] blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* ── Header ── */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20">
              <BookMarked className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
                Kibera Academy · Admin
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Subject Allocation
              </h1>
            </div>
          </div>

          <nav className="flex items-center gap-2 flex-wrap">
            <GenerateTimetableButton academicYear={2026} />
            <NavLink
              href="/dashboard"
              icon={<LayoutDashboard className="h-4 w-4" />}
            >
              Dashboard
            </NavLink>
            <NavLink href="/timetable" icon={<Calendar className="h-4 w-4" />}>
              Timetable
            </NavLink>
            <NavLink
              href="/admission"
              icon={<UserRoundPlus className="h-4 w-4" />}
              primary
            >
              Admit Student
            </NavLink>
          </nav>
        </header>

        {/* Summary strip */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryChip label="Teachers" value={teachers.length} color="amber" />
          <SummaryChip
            label="CBC Subjects"
            value={subjects.length}
            color="sky"
          />
          <SummaryChip
            label="Allocations"
            value={allocations.length}
            color="emerald"
          />
        </div>

        {/* Main card */}
        {teachers.length === 0 ? (
          <EmptyState message="No teachers found. Add teachers to the system first." />
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/30 to-transparent mb-6" />
            <AllocationPanel
              teachers={teachers}
              subjects={subjects}
              allocations={allocations}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface NavLinkProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  primary?: boolean;
}

function NavLink({ href, icon, children, primary }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 ${
        primary
          ? "bg-amber-400 text-[#0c0f1a] hover:bg-amber-300"
          : "border border-white/10 text-white/60 hover:text-white hover:border-white/20 hover:bg-white/5"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

interface SummaryChipProps {
  label: string;
  value: number;
  color: "amber" | "sky" | "emerald";
}

const chipColors = {
  amber: "bg-amber-400/5 border-amber-400/15 text-amber-400",
  sky: "bg-sky-400/5 border-sky-400/15 text-sky-400",
  emerald: "bg-emerald-400/5 border-emerald-400/15 text-emerald-400",
};

function SummaryChip({ label, value, color }: SummaryChipProps) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-center ${chipColors[color]}`}
    >
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-white/30 mt-0.5">
        {label}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-white/10">
      <p className="text-4xl mb-3">📋</p>
      <p className="text-white/40 text-sm">{message}</p>
    </div>
  );
}
