// app/admin/applications/page.tsx
import { redirect }           from "next/navigation";
import { getSession }         from "@/lib/actions/auth";
import { fetchApplications }  from "@/lib/actions/applications";
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
  const status = (sp.status ?? "all") as any;
  const page   = Number(sp.page ?? 1);

  const { data, count } = await fetchApplications(status, page);

  // Counts per status tab
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

  return (
    <ApplicationsClient
      applications={data}
      counts={counts}
      currentStatus={status}
      currentPage={page}
      totalCount={count}
    />
  );
}