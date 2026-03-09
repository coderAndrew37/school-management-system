// app/parent/fees/page.tsx
import { getSession } from "@/lib/actions/auth";
import { fetchAllChildData, fetchMyChildren } from "@/lib/data/parent";
import { redirect } from "next/navigation";
import { FeesPageClient } from "./FeesPageClient";

export const metadata = { title: "Fees | Kibali Parent Portal" };
export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{ child?: string }>;
}

export default async function FeesPage({ searchParams }: PageProps) {
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
    <FeesPageClient
      feePayments={childData.feePayments}
      child={activeChild}
      children={children}
    />
  );
}
