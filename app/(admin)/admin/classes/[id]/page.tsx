import { getSession } from "@/lib/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ArrowLeft,
  Calendar,
  GraduationCap,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

// Next.js 15 requires params to be a Promise
type Props = {
  params: Promise<{ id: string }>;
};

export default async function ClassDetailsPage({ params }: Props) {
  // 1. Await params first
  const { id } = await params;

  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login");
  }

  const supabase = await createSupabaseServerClient();

  // 2. Fetch Class details + Students + Assigned Teacher
  // Using the awaited 'id' here
  const { data: classData, error } = await supabase
    .from("classes")
    .select(
      `
      *,
      students (
        id,
        full_name,
        upi_number,
        gender,
        status,
        photo_url
      ),
      class_teacher_assignments (
        is_active,
        teachers (
          full_name,
          staff_id
        )
      )
    `,
    )
    .eq("id", id)
    .single();

  if (error || !classData) {
    console.error("Error fetching class or class not found:", error);
    notFound();
  }

  const activeTeacher = classData.class_teacher_assignments?.find(
    (a: any) => a.is_active,
  )?.teachers;

  const students = classData.students || [];
  const maleCount = students.filter((s: any) => s.gender === "Male").length;
  const femaleCount = students.filter((s: any) => s.gender === "Female").length;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumbs & Actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/classes"
            className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Registry
          </Link>
          <div className="flex gap-2">
            <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">
              Edit Class
            </button>
          </div>
        </div>

        {/* Hero Header */}
        <div className="bg-[#1e293b] border border-slate-800 rounded-3xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <GraduationCap size={120} className="text-blue-500" />
          </div>

          <div className="relative z-10 space-y-4">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 bg-blue-400/10 px-3 py-1 rounded-full">
              {classData.level.replace("_", " ")}
            </span>
            <h1 className="text-4xl font-black text-white">
              {classData.grade} — {classData.stream}
            </h1>

            <div className="flex flex-wrap gap-6 pt-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Total Students
                  </p>
                  <p className="text-lg font-bold text-white">
                    {students.length}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 border-l border-slate-800 pl-6">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                  <UserCheck size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Class Teacher
                  </p>
                  <p className="text-lg font-bold text-white">
                    {activeTeacher?.full_name || "Unassigned"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 border-l border-slate-800 pl-6">
                <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500">
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    Academic Year
                  </p>
                  <p className="text-lg font-bold text-white">
                    {classData.academic_year}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roster Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-white">Student Roster</h2>
              <p className="text-xs font-bold text-slate-500">
                {maleCount}M / {femaleCount}F
              </p>
            </div>

            <div className="bg-[#1e293b] border border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-800/50 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4">UPI / ID</th>
                    <th className="px-6 py-4">Gender</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {students.map((student: any) => (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-blue-400">
                            {student.full_name.charAt(0)}
                          </div>
                          <span className="font-bold text-white">
                            {student.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        {student.upi_number || "N/A"}
                      </td>
                      <td className="px-6 py-4 capitalize text-slate-300">
                        {student.gender}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/students/${student.id}`}
                          className="text-blue-400 hover:text-white font-bold text-xs"
                        >
                          Profile
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {students.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-10 text-center text-slate-500 italic"
                      >
                        No students enrolled in this class yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-6">
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6">
              <h3 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-4">
                Quick Insights
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-xs text-slate-400">
                    Enrollment Capacity
                  </span>
                  <span className="text-sm font-bold text-white">
                    {students.length} / 45
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all"
                    style={{ width: `${(students.length / 45) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
