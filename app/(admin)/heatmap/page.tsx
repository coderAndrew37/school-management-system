// app/admin/heatmap/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchHeatmapData } from "@/lib/data/heatmap";
import { HeatmapClient } from "./HeatmapClient";

export const metadata = { title: "Class Performance Heatmap | Kibali Admin" };
export const revalidate = 0;

interface Props {
  searchParams: Promise<{ term?: string; year?: string }>;
}

export default async function HeatmapPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login");
  }

  const sp = await searchParams;
  const term = Math.min(3, Math.max(1, parseInt(sp.term ?? "1", 10)));
  const year = parseInt(sp.year ?? "2026", 10);

  const data = await fetchHeatmapData(term, year);

  return <HeatmapClient data={data} />;
}
