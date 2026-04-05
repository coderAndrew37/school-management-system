import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PlusCircle, LayoutGrid, School } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";

export const metadata = { title: "Class Management | Kibali Admin" };
export const revalidate = 0;

export default async function ClassesPage() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // 1. Get current setting for the year
  const { data: settings } = await supabase
    .from("system_settings")
    .select("current_academic_year")
    .single();

  const activeYear = settings?.current_academic_year ?? 2026;

  // 2. Fetch all classes for the year
  const { data: classes, error } = await supabase
    .from("classes")
    .select("*")
    .eq("academic_year", activeYear)
    .order("grade", { ascending: true });

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <School className="text-blue-500" /> Class Registry
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
              Academic Year {activeYear}
            </p>
          </div>
          <Link
            href="/admin/classes/new"
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-900/20"
          >
            <PlusCircle className="h-4 w-4" />
            Add New Class
          </Link>
        </div>

        {/* Classes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes?.map((c) => (
            <div
              key={c.id}
              className="bg-[#1e293b] border border-slate-800 p-5 rounded-2xl hover:border-blue-500/50 transition-all group relative overflow-hidden"
            >
              <LayoutGrid className="absolute -right-2 -bottom-2 h-16 w-16 text-slate-700/10 group-hover:scale-110 transition-transform" />

              <div className="relative z-10">
                <span className="text-[10px] font-black uppercase text-blue-400 bg-blue-400/10 px-2 py-1 rounded">
                  {c.level.replace("_", " ")}
                </span>
                <h3 className="text-xl font-bold text-white mt-3">{c.grade}</h3>
                <p className="text-sm text-slate-400 font-medium">
                  Stream: <span className="text-slate-200">{c.stream}</span>
                </p>

                <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center">
                  <Link
                    href={`/admin/classes/${c.id}`}
                    className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
                  >
                    View Details →
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {classes?.length === 0 && (
            <div className="col-span-full py-20 text-center bg-[#1e293b]/30 rounded-3xl border border-dashed border-slate-800">
              <p className="text-slate-500 font-medium">
                No classes registered for {activeYear} yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
