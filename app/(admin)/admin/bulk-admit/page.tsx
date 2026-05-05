import { getSession } from "@/lib/actions/auth";
import { fetchClasses } from "@/lib/data/classes";
import { redirect } from "next/navigation";
import { BulkAdmitClient } from "./BulkAdmitClient";

export const metadata = { 
  title: "Bulk Admission | Kibali Academy" 
};

export default async function BulkAdmitPage() {
  const session = await getSession();
  
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login");
  }

  
 const classes = await fetchClasses();
  return <BulkAdmitClient classes={classes ?? []} />;
}