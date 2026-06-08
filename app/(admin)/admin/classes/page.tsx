import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlusCircle, LayoutGrid, School, ChevronRight } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";

export const metadata = { title: "Class Management | Kibali Admin" };
export const revalidate = 0;

export default async function ClassesPage() {
  const session = await getSession();

  if (!session?.profile) redirect("/login");

  const { base_role, is_super_admin, is_dev, school_id } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  if (base_role !== "admin" && !isPlatformAdmin) redirect("/dashboard");
  if (!school_id) redirect("/login");

  const supabase = await createSupabaseServerClient();

  const [{ data: settings }, { data: classes }] = await Promise.all([
    supabase
      .from("system_settings")
      .select("current_academic_year")
      .eq("id", 1)
      .single(),
    supabase
      .from("classes")
      .select("*")
      .eq("school_id", school_id)
      .order("grade", { ascending: true }),
  ]);

  const activeYear = settings?.current_academic_year ?? 2026;

  const filteredClasses = (classes ?? []).filter(
    (c) => c.academic_year === activeYear,
  );

  // Group by level for a richer layout
  const byLevel = filteredClasses.reduce<Record<string, typeof filteredClasses>>(
    (acc, c) => {
      const key = c.level ?? "other";
      acc[key] = [...(acc[key] ?? []), c];
      return acc;
    },
    {},
  );

  const levelOrder = ["lower_primary", "upper_primary", "junior_secondary", "other"];
  const levelLabels: Record<string, string> = {
    lower_primary:    "Lower Primary",
    upper_primary:    "Upper Primary",
    junior_secondary: "Junior Secondary",
    other:            "Other",
  };
  const levelAccent: Record<string, { dot: string; badge: string; badgeText: string }> = {
    lower_primary:    { dot: "bg-sky-400",    badge: "bg-sky-400/10 border-sky-400/20",    badgeText: "text-sky-400"    },
    upper_primary:    { dot: "bg-amber-400",  badge: "bg-amber-400/10 border-amber-400/20", badgeText: "text-amber-400"  },
    junior_secondary: { dot: "bg-emerald-400",badge: "bg-emerald-400/10 border-emerald-400/20",badgeText:"text-emerald-400"},
    other:            { dot: "bg-white/30",   badge: "bg-white/5 border-white/10",          badgeText: "text-white/50"   },
  };

  const sortedLevels = levelOrder.filter((l) => byLevel[l]?.length);

  return (
    <div className="min-h-screen bg-[#0c0f1a] font-[family-name:var(--font-body)]">

      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute -top-60 left-1/4 w-[700px] h-[700px] rounded-full bg-amber-500/[0.04] blur-[140px]" />
        <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full bg-emerald-500/[0.04] blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full bg-sky-500/[0.04] blur-[100px]" />
      </div>

      {/* ── Header ── */}
      <header className="bg-[#0c0f1a]/80 backdrop-blur-md border-b border-white/[0.07] sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center">
              <School className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400/70">
                Kibali Academy
              </p>
              <h1 className="text-sm font-bold tracking-tight text-white">
                Class Registry
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/classes/new"
              className="flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-95 transition-all duration-200 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-[#0c0f1a] shadow-lg shadow-amber-400/20"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Add Class
            </Link>
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-1 text-xs font-semibold text-white/30 hover:text-white/70 transition-colors"
            >
              Back <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Stats bar ── */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <p className="text-2xl font-black text-white">{filteredClasses.length}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-1">
              Total Classes
            </p>
          </div>
          {sortedLevels.map((level) => {
            const accent = levelAccent[level] ?? levelAccent.other;
            return (
              <div
                key={level}
                className={`rounded-2xl border p-4 ${accent.badge}`}
              >
                <p className={`text-2xl font-black ${accent.badgeText}`}>
                  {byLevel[level].length}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-1">
                  {levelLabels[level] ?? level}
                </p>
              </div>
            );
          })}
        </section>

        {/* ── Classes by level ── */}
        {sortedLevels.length > 0 ? (
          sortedLevels.map((level) => {
            const accent = levelAccent[level] ?? levelAccent.other;
            return (
              <section key={level} className="space-y-3">
                {/* Section label */}
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/25 px-1 flex items-center gap-2">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                  {levelLabels[level] ?? level}
                  <span className="text-white/15">({byLevel[level].length})</span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {byLevel[level].map((c) => (
                    <Link
                      key={c.id}
                      href={`/admin/classes/${c.id}`}
                      className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 hover:border-white/[0.15] hover:bg-white/[0.05] transition-all duration-200 relative overflow-hidden"
                    >
                      {/* Decorative bg icon */}
                      <LayoutGrid className="absolute -right-3 -bottom-3 h-16 w-16 text-white/[0.03] group-hover:text-white/[0.06] group-hover:scale-110 transition-all duration-300" />

                      <div className="relative z-10">
                        {/* Level badge */}
                        <span className={`inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${accent.badge} ${accent.badgeText}`}>
                          {(c.level ?? "other").replace("_", " ")}
                        </span>

                        {/* Grade + stream */}
                        <h3 className="text-xl font-black text-white mt-3 tracking-tight">
                          {c.grade}
                        </h3>
                        <p className="text-sm text-white/40 font-medium mt-0.5">
                          Stream:{" "}
                          <span className="text-white/70">{c.stream}</span>
                        </p>

                        {/* Footer */}
                        <div className="mt-5 pt-4 border-t border-white/[0.07] flex items-center justify-between">
                          <span className="text-[11px] font-bold text-white/25 uppercase tracking-wider">
                            {activeYear}
                          </span>
                          <span className="text-[11px] font-bold text-white/30 group-hover:text-amber-400/70 flex items-center gap-1 transition-colors">
                            Details <ChevronRight className="h-3 w-3" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        ) : (
          /* ── Empty state ── */
          <div className="text-center py-24 rounded-3xl border border-dashed border-white/[0.07]">
            <div className="h-14 w-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center mx-auto mb-4">
              <School className="h-6 w-6 text-white/20" />
            </div>
            <p className="text-sm font-semibold text-white/30">
              No classes registered for {activeYear} yet.
            </p>
            <Link
              href="/admin/classes/new"
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-amber-400/60 hover:text-amber-400 transition-colors"
            >
              <PlusCircle className="h-3.5 w-3.5" /> Add the first class
            </Link>
          </div>
        )}

        {/* ── Footer ── */}
        <footer className="pt-4 border-t border-white/[0.05]">
          <p className="text-center text-xs text-white/20">
            Kibali Academy · CBC School Management System · Academic Year {activeYear}
          </p>
        </footer>

      </main>
    </div>
  );
}