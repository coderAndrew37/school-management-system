import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchMyChildren } from "@/lib/data/parent";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveTermYear } from "@/lib/utils/settings";
import type { ParentReportCard } from "@/lib/data/parent";
import { ParentReportsClient } from "./ReportsPageClient";

export const metadata = { title: "Report Cards | Kibali Parent Portal" };
export const revalidate = 0;

interface Props {
  searchParams: Promise<{ child?: string }>;
}

export default async function ParentReportsPage({ searchParams }: Props) {
  const session = await getSession();

  // Guard: Ensure session and email exist
  if (!session || !session.user?.email || session.profile.role !== "parent") {
    redirect("/login");
  }

  // Fix: Pass session email to fetchMyChildren
  const children = await fetchMyChildren(session.user.email);
  if (children.length === 0) redirect("/parent");

  const sp = await searchParams;
  const activeChild = children.find((c) => c.id === sp.child) ?? children[0]!;

  // Fetch all published report cards for this child
  const { data: rawCards } = await supabaseAdmin
    .from("report_cards")
    .select(
      "id, term, academic_year, status, class_teacher_remarks, conduct_grade, effort_grade, published_at",
    )
    .eq("student_id", activeChild.id)
    .eq("status", "published")
    .order("academic_year", { ascending: false })
    .order("term", { ascending: false });

  const reportCards = (rawCards ?? []) as ParentReportCard[];

  // Active term/year for highlighting the current period
  const { term: currentTerm, academicYear: currentYear } =
    await getActiveTermYear();

  return (
    <ParentReportsClient
      allChildren={children}
      activeChildId={activeChild.id}
      activeChildName={activeChild.full_name}
      // Passing grade_label for better UI display (e.g., "Grade 4 East" vs "4")
      activeChildGrade={activeChild.grade_label}
      reportCards={reportCards}
      currentTerm={currentTerm}
      currentYear={currentYear}
    />
  );
}