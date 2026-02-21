import { fetchChild } from "@/lib/data/parent";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChildProfileClient } from "../../_components/ChildProfileClient";
import { ParentShell } from "../../_components/ParentShell";

export const metadata: Metadata = {
  title: "Child Profile | Kibera Academy",
};

interface ChildPageParams {
  params: Promise<{ id: string }>;
}

export default async function ChildProfilePage({ params }: ChildPageParams) {
  const { id } = await params;
  const child = await fetchChild(id);

  if (child === null) notFound();

  return (
    <ParentShell>
      <ChildProfileClient child={child} />
    </ParentShell>
  );
}
