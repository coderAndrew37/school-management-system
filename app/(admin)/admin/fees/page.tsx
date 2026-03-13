// app/admin/fees/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import {
  fetchFeeStructures,
  fetchFeeRecords,
  fetchFeeDashboardStats,
} from "@/lib/actions/fees";
import { FeesAdminClient } from "./FeesAdminClient";

export const metadata = { title: "Fee Management | Kibali Admin" };
export const revalidate = 0;

interface Props {
  searchParams: Promise<{ year?: string }>;
}

export default async function FeesAdminPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login");
  }

  const sp = await searchParams;
  const academic_year = parseInt(sp.year ?? "2026", 10);

  const [structures, records, stats] = await Promise.all([
    fetchFeeStructures(academic_year),
    fetchFeeRecords(academic_year),
    fetchFeeDashboardStats(academic_year),
  ]);

  return (
    <FeesAdminClient
      structures={structures}
      records={records}
      stats={stats}
      academic_year={academic_year}
    />
  );
}
