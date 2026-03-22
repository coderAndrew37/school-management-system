// app/teacher/attendance/page.tsx
// Smart redirect — attendance in CBC is taken once daily by the CLASS TEACHER.
// If this teacher IS a class teacher, send them to the proper register.
// If not, show a clear explanation rather than a duplicate form.

import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchMyClassTeacherAssignments } from "@/lib/actions/class-teacher";
import { CalendarCheck, ArrowRight, Info } from "lucide-react";

export const metadata = { title: "Attendance | Kibali Teacher Portal" };

export default async function AttendancePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const assignment = await fetchMyClassTeacherAssignments();

  // Class teacher → send straight to the register
  if (assignment?.isClassTeacher && assignment.grades.length > 0) {
    const dest =
      assignment.grades.length === 1
        ? `/teacher/class/attendance?grade=${encodeURIComponent(assignment.grades[0]!)}`
        : "/teacher/class/attendance";
    redirect(dest);
  }

  // Not a class teacher — explain and link back
  return (
    <div className="min-h-screen bg-[#F8F7F2] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm max-w-md w-full p-8 text-center space-y-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 border border-sky-200 mx-auto">
          <CalendarCheck className="h-7 w-7 text-sky-500" />
        </div>

        <div>
          <h1 className="text-lg font-black text-slate-800">
            Attendance Register
          </h1>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed">
            In CBC, the daily attendance register is maintained by the{" "}
            <strong className="text-slate-700">class teacher</strong>. You are
            currently not assigned as a class teacher for any grade.
          </p>
        </div>

        <div className="rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 flex items-start gap-3 text-left">
          <Info className="h-4 w-4 text-sky-500 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-700 leading-relaxed">
            If you believe you should have class teacher access, contact the
            school administrator to assign you to a grade on the{" "}
            <strong>Class Teachers</strong> page.
          </p>
        </div>

        <Link
          href="/teacher"
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold py-3 transition-colors"
        >
          Back to Dashboard <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
