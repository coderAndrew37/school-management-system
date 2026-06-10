// app/parent/layout.tsx — Kibali Academy

import { headers } from "next/headers";
import { ParentClientShell } from "./layout.client";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Feed active location context cleanly from middleware headers injection
  const headersList = await headers();
  const pathname = headersList.get("X-Pathname") ?? "/parent/dashboard";

  return (
    <ParentClientShell pathname={pathname}>
      {children}
    </ParentClientShell>
  );
}