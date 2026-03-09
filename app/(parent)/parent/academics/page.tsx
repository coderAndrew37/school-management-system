// app/parent/academics/page.tsx
import { getSession } from "@/lib/actions/auth";
import { fetchMyChildren } from "@/lib/data/parent";
import { redirect } from "next/navigation";
import { AcademicsPageClient } from "./AcademicsPageClient";

export const metadata = { title: "Academics | Kibali Parent Portal" };
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function AcademicsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || session.profile.role !== "parent") redirect("/login");

  const { child: childParam } = await searchParams;
  const children = await fetchMyChildren();
  if (children.length === 0) redirect("/parent");

  const activeChild = children.find((c) => c.id === childParam) ?? children[0]!;

  return <AcademicsPageClient child={activeChild} children={children} />;
}
