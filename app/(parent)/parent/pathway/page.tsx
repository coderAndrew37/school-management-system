// app/parent/pathway/page.tsx
import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import { redirect } from "next/navigation";
import { PathwayPageClient } from "./PathwayPageClient";

export const metadata = { title: "JSS Pathway | Kibali Parent Portal" };
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function PathwayPage({ searchParams }: PageProps) {
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
    <PathwayPageClient
      pathway={childData.pathway}
      child={activeChild}
      children={children}
    />
  );
}
