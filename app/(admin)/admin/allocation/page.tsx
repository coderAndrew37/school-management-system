// app/admin/allocation/page.tsx

import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BookMarked,
  Calendar,
  LayoutDashboard,
  UserRoundPlus,
} from "lucide-react";
import { getSession } from "@/lib/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSubjects, fetchAllocations } from "@/lib/data/allocation";
import type { Teacher, TeacherStatus } from "@/lib/types/dashboard";
import { GenerateTimetableButton } from "../../../_components/allocation/GenerateTimetableButton";
import { AllocationPanel } from "../../../_components/allocation/AllocationPanel";
import { SubjectManagerModal } from "../../../_components/allocation/SubjectManagerModal";
import { getActiveTermYear } from "@/lib/utils/settings";
import { Class } from "@/lib/types/allocation";

export const metadata = { title: "Subject Allocation | Kibali Academy" };
export const revalidate = 60;

// ── 1. Strict Internal Data Interface Contracts ──────────────────────────────

interface RawTeacherRow {
  id: string;
  staff_id: string | null;
  tsc_number: string | null;
  status: string;
  invite_accepted: boolean;
  last_invite_sent: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    phone_number: string | null;
    avatar_url?: string | null;
  } | {
    full_name: string;
    email: string;
    phone_number: string | null;
    avatar_url?: string | null;
  }[] | null;
}

// ── 2. Server Data Fetching Block ────────────────────────────────────────────

async function fetchTeachers(schoolId: string): Promise<Teacher[]> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("teachers")
    .select(`
      id, staff_id, tsc_number, status, invite_accepted, last_invite_sent, created_at,
      profiles ( full_name, email, phone_number, avatar_url )
    `)
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (error || !data) {
    console.error("Error fetching multi-tenant teachers:", error);
    return [];
  }

  const rawRows = data as unknown as RawTeacherRow[];

  return rawRows.map((row): Teacher => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      id: row.id,
      staff_id: row.staff_id ?? "PENDING",
      full_name: profile?.full_name ?? "Unknown Staff",
      email: profile?.email ?? "",
      tsc_number: row.tsc_number,
      phone_number: profile?.phone_number ?? null, // Fixed: Maps undefined fallback seamlessly back to string | null
      status: row.status as TeacherStatus, // Fixed: Force casts verified schema string checks safely to type matching targets
      last_invite_sent: row.last_invite_sent,
      created_at: row.created_at,
      invite_accepted: row.invite_accepted,
      avatar_url: profile?.avatar_url ?? null,
    };
  }).sort((a, b) => a.full_name.localeCompare(b.full_name));
}

async function fetchClasses(schoolId: string): Promise<Class[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id, school_id, grade, stream, level, academic_year, created_at")
    .eq("school_id", schoolId)
    .order("grade", { ascending: true });

  if (error) {
    console.error("Error fetching classes:", error);
    return [];
  }
  return (data ?? []) as Class[];
}

// ── 3. Main Page Module Component ───────────────────────────────────────────

export default async function AllocationPage() {
  // ── Access Control & Multi-Tenant Hook Verification Guard ─────────────────
  const session = await getSession();
  
  if (!session || !session.profile) {
    redirect("/login?redirectTo=/admin/allocation");
  }

  const { base_role, is_super_admin, is_dev, school_id } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  if (base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  if (!school_id) {
    return (
      <div className="min-h-screen bg-[#0c0f1a] flex items-center justify-center text-white text-xs font-mono">
        CRITICAL ERROR: Active administrative session missing mandatory isolation school_id context tracking bounds.
      </div>
    );
  }

  // ── Data Loading Pipeline Context ──────────────────────────────────────────
  const { academicYear } = await getActiveTermYear();

  const [teachers, subjects, allocations, classes] = await Promise.all([
  fetchTeachers(school_id),
  fetchSubjects(), 
  fetchAllocations(school_id, academicYear), // Passed school_id here explicitly
  fetchClasses(school_id),
]);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] rounded-full bg-amber-500/[0.04] blur-[130px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-500/[0.03] blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 border border-amber-400/20">
              <BookMarked className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
                Kibali Academy · Admin
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Subject Allocation
              </h1>
              <p className="text-[11px] text-white/25 mt-0.5 font-mono">
                Academic Year {academicYear}
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-2 flex-wrap">
            <SubjectManagerModal subjects={subjects} />
            <GenerateTimetableButton academicYear={academicYear} />

            <NavLink
              href="/admin"
              icon={<LayoutDashboard className="h-4 w-4" />}
            >
              Dashboard
            </NavLink>
            <NavLink
              href="/admin/timetable"
              icon={<Calendar className="h-4 w-4" />}
            >
              Timetable
            </NavLink>
            <NavLink
              href="/admin/admit"
              icon={<UserRoundPlus className="h-4 w-4" />}
              primary
            >
              Admit Student
            </NavLink>
          </nav>
        </header>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryChip label="Teachers" value={teachers.length} color="amber" />
          <SummaryChip
            label="CBC Subjects"
            value={subjects.length}
            color="sky"
          />
          <SummaryChip
            label="Active Classes"
            value={classes.length}
            color="sky"
          />
          <SummaryChip
            label="Allocations"
            value={allocations.length}
            color="emerald"
          />
        </div>

        {/* Main content */}
        {teachers.length === 0 ? (
          <EmptyState message="No teachers found. Add teachers to the system first." />
        ) : subjects.length === 0 ? (
          <EmptyState
            message="No subjects found. Click 'Manage Subjects' above to add CBC subjects."
          />
        ) : classes.length === 0 ? (
          <EmptyState message="No classes found. Set up your grades and streams before allocating." />
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-xl p-6">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-400/30 to-transparent mb-6" />
            <AllocationPanel
              teachers={teachers}
              subjects={subjects}
              allocations={allocations}
              classes={classes}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── 4. Sub-components ────────────────────────────────────────────────────────

function NavLink({
  href,
  icon,
  children,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
        primary
          ? "bg-amber-400 text-[#0c0f1a] hover:bg-amber-300 shadow-md shadow-amber-400/10"
          : "border border-white/10 text-white/60 hover:text-white hover:border-white/20 hover:bg-white/5"
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}

const chipColors = {
  amber: "bg-amber-400/5   border-amber-400/15   text-amber-400",
  sky: "bg-sky-400/5     border-sky-400/15     text-sky-400",
  emerald: "bg-emerald-400/5 border-emerald-400/15 text-emerald-400",
};

function SummaryChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: keyof typeof chipColors;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-center transition-all duration-300 hover:scale-[1.01] ${chipColors[color]}`}
    >
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mt-0.5">
        {label}
      </p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed border-white/10 bg-white/[0.01]">
      <p className="text-3xl mb-3 opacity-60">📋</p>
      <p className="text-white/40 text-xs px-6 text-center tracking-tight max-w-xs">{message}</p>
    </div>
  );
}