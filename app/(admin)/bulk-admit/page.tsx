// app/admin/bulk-admit/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import { BulkAdmitClient } from "./BulkAdmitClient";

export const metadata = { title: "Bulk Admission | Kibali Admin" };

export default async function BulkAdmitPage() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login");
  }
  return <BulkAdmitClient />;
}
