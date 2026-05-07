import type { Metadata } from "next";
import type { UserRole } from "@/lib/types/auth";
import { ChooseRoleForm } from "@/app/_components/auth/ChooseRoleForm";

export const metadata: Metadata = { title: "Choose Portal | Kibali Academy" };

interface Props {
  searchParams: Promise<{ roles?: string; redirectTo?: string }>;
}

export default async function ChooseRolePage({ searchParams }: Props) {
  const params = await searchParams;
  const roles = (params.roles?.split(",").filter(Boolean) ?? []) as UserRole[];
  return <ChooseRoleForm roles={roles} redirectTo={params.redirectTo} />;
}