import type { Metadata } from "next";
import { type BaseRole, BASE_ROLES } from "@/lib/types/auth";
import { ChooseRoleForm } from "@/app/_components/auth/ChooseRoleForm";

export const metadata: Metadata = { title: "Choose Portal | Kibali Academy" };

interface Props {
  searchParams: Promise<{ roles?: string; redirectTo?: string }>;
}

export default async function ChooseRolePage({ searchParams }: Props) {
  const params = await searchParams;
  
  // Parse, sanitize, and validate incoming tokens against our strict BaseRole array
  const rawRoles = params.roles?.split(",") ?? [];
  const validatedRoles = rawRoles.filter((role): role is BaseRole => 
    BASE_ROLES.includes(role as BaseRole)
  );

  return <ChooseRoleForm roles={validatedRoles} redirectTo={params.redirectTo} />;
}