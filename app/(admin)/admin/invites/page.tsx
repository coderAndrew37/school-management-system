// app/admin/invites/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchParentsInviteStatus } from "@/lib/actions/bulk-invite";
import { BulkInviteClient } from "@/app/_components/BulkInviteClient";

export const metadata = { title: "Parent Invites | Kibali Admin" };
export const revalidate = 0;

export default async function BulkInvitePage() {
  const session = await getSession();
  
  if (!session || !session.profile) {
    redirect("/login?redirectTo=/admin/invites");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Protect the route using the updated BaseRole structural check
  if (base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  const { parents, error } = await fetchParentsInviteStatus();
  if (error) console.error("[BulkInvitePage]", error);

  return <BulkInviteClient parents={parents ?? []} />;
}