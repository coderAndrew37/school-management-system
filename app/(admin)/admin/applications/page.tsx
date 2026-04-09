import { redirect }           from "next/navigation";
import { getSession }         from "@/lib/actions/auth";
import { fetchApplications, ApplicationStatus }  from "@/lib/actions/applications";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApplicationsClient } from "./ApplicationsClient";

export const metadata = { title: "Applications | Kibali Academy Admin" };
export const revalidate = 0;

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login?redirectTo=/admin/applications");
  }

  const sp     = await searchParams;
  const status = (sp.status ?? "all") as ApplicationStatus | "all";
  const page   = Number(sp.page ?? 1);

  // 1. Fetch applications and counts
  const { data, count } = await fetchApplications(status, page);

  const [pendingResult, reviewingResult, approvedResult, declinedResult] =
    await Promise.all([
      fetchApplications("pending",   1, 1),
      fetchApplications("reviewing", 1, 1),
      fetchApplications("approved",  1, 1),
      fetchApplications("declined",  1, 1),
    ]);

  const counts = {
    all:       count,
    pending:   pendingResult.count,
    reviewing: reviewingResult.count,
    approved:  approvedResult.count,
    declined:  declinedResult.count,
  };

  // 2. Fetch classes for the conversion dropdown
  const supabase = await createSupabaseServerClient();
  const { data: classesData } = await supabase
    .from("classes")
    .select("id, name")
    .order("name", { ascending: true });

  const classes = classesData ?? [];

  return (
    <ApplicationsClient
      applications={data}
      counts={counts}
      currentStatus={status}
      currentPage={page}
      totalCount={count}
      classes={classes}
    />
  );
}