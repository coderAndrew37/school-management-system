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

  // Guard: Ensure session and profile exist
  if (!session || !session.profile || !session.user?.email) {
    redirect("/login");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Protect the route using the updated BaseRole structural check for parents
  if (base_role !== "parent" && !isPlatformAdmin) {
    redirect("/login");
  }

  const { child: childParam } = await searchParams;

  // Pass session email to fetch children bounded to this parent account
  const children = await fetchMyChildren(session.user.email);
  
  if (children.length === 0) {
    redirect("/parent");
  }

  // Find the selected child or default to the first one
  const activeChild = children.find((c) => c.id === childParam) ?? children[0]!;

  return (
    <AcademicsPageClient 
      child={activeChild} 
      allChildren={children} 
    />
  );
}