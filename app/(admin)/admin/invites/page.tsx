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

  const { is_super_admin, is_dev, school_id, allowed_permissions_override } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;
  const hasAccess = isPlatformAdmin || allowed_permissions_override?.includes("manage_communications") || allowed_permissions_override?.includes("manage_allocations");

  // Granular architecture permission check replacement
  if (!hasAccess) {
    redirect("/dashboard");
  }

  if (!school_id) {
    redirect("/dashboard");
  }

  // Inject structural school isolation boundaries
  const { parents, error } = await fetchParentsInviteStatus(school_id);
  if (error) console.error("[BulkInvitePage]", error);

  return <BulkInviteClient parents={parents ?? []} />;
}