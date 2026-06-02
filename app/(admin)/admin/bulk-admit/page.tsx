// app/admin/students/bulk/page.tsx
import { getSession } from "@/lib/actions/auth";
import { fetchClasses } from "@/lib/data/classes";
import { redirect } from "next/navigation";
import { BulkAdmitClient } from "./BulkAdmitClient";

// ── Strict Structural Type for Class Items ──────────────────────────────────
export interface BulkAdmitClassItem {
  id: string;
  grade: string;
  stream: string;
  academic_year: number;
}

export const metadata = { 
  title: "Bulk Admission | Kibali Academy" 
};

export default async function BulkAdmitPage() {
  const session = await getSession();
  
  if (!session || !session.profile) {
    redirect("/login");
  }

  const { base_role, is_super_admin, is_dev } = session.profile;
  const isPlatformAdmin = is_super_admin || is_dev;

  // Protect the route using the updated BaseRole structural check
  if (base_role !== "admin" && !isPlatformAdmin) {
    redirect("/dashboard");
  }

  // Fetch classes and explicitly type cast the return array
  const rawClasses = await fetchClasses();
  const classes: BulkAdmitClassItem[] = (rawClasses ?? []) as unknown as BulkAdmitClassItem[];

  return <BulkAdmitClient classes={classes} />;
}