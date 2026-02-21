import { fetchChild } from "@/lib/data/parent";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import { ParentShell } from "../../../_components/ParentShell";
import { ProgressReportClient } from "../../../_components/ProgressReportClient";

export const metadata: Metadata = {
  title: "Progress Report | Kibera Academy",
};

interface ChildPageParams {
  params: Promise<{ id: string }>;
}

export default async function ProgressReportPage({ params }: ChildPageParams) {
  const { id } = await params;
  const child = await fetchChild(id);

  if (child === null) notFound();

  return (
    <ParentShell>
      <ProgressReportClient child={child} />
    </ParentShell>
  );
}
