import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import { redirect } from "next/navigation";
import { DiaryPageClient } from "./DiaryPageClient";

export const metadata = { title: "Diary | Kibali Parent Portal" };
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function DiaryPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || session.profile.role !== "parent") redirect("/login");

  const _sp = await searchParams;
  const childParam = _sp?.child;
  const children = await fetchMyChildren();
  if (children.length === 0) redirect("/parent");

  const activeChild = children.find((c) => c.id === childParam) ?? children[0]!;
  const childData = await fetchAllChildData(
    activeChild.id,
    activeChild.current_grade,
  );

  return (
    <DiaryPageClient
      diary={childData.diary}
      child={activeChild}
      children={children}
    />
  );
}
