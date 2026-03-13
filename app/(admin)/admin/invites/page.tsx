import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { fetchParentsInviteStatus } from "@/lib/actions/bulk-invite";
import { BulkInviteClient } from "@/app/_components/BulkInviteClient";

export const metadata = { title: "Parent Invites | Kibali Admin" };
export const revalidate = 0;

export default async function BulkInvitePage() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login");
  }

  const { parents, error } = await fetchParentsInviteStatus();
  if (error) console.error("[BulkInvitePage]", error);

  return <BulkInviteClient parents={parents} />;
}
