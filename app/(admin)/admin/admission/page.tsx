// app/admin/admit/page.tsx
// Server component — auth guard + no data to prefetch for admission.
// The form itself handles parent search via server actions.

import { redirect } from "next/navigation";
import { getSession } from "@/lib/actions/auth";
import AdmissionForm from "@/app/_components/AdmissionForm";

export const metadata = {
  title: "New Student Admission | Kibali Academy",
  description: "Admit a new student to Kibali Academy",
};

export default async function AdmissionPage() {
  const session = await getSession();
  if (!session || !["admin", "superadmin"].includes(session.profile.role)) {
    redirect("/login?redirectTo=/admin/admit");
  }

  return <AdmissionForm />;
}
