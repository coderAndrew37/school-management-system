import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { toBaseRoleArray, type BaseRole } from "@/lib/types/auth";
import { ChooseRoleForm } from "@/app/_components/auth/ChooseRoleForm";
import { getSession } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Choose Portal | Kibali Academy" };

interface Props {
  searchParams: Promise<{ roles?: string; redirectTo?: string }>;
}

export default async function ChooseRolePage({ searchParams }: Props) {
  const params = await searchParams;
  let validatedRoles: BaseRole[] = [];

  // 1. Parse comma-separated roles from search params (set by middleware redirect).
  if (params.roles) {
    validatedRoles = toBaseRoleArray(params.roles.split(","));
  }

  // 2. Hardening: always cross-check against the live session, which is the
  //    canonical source. Search params can be stale, stripped, or tampered with.
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Prefer the session's allRoles — it reflects the current DB state.
  // Only fall back to the search-param roles if the session somehow returns none
  // (shouldn't happen, since resolveAllRoles always returns at least ["parent"]).
  if (session.allRoles.length > 0) {
    validatedRoles = session.allRoles;
  }

  // 3. Final guard: a single-role user has no business on this page.
  if (validatedRoles.length === 0) {
    redirect("/login");
  }

  if (validatedRoles.length === 1) {
    redirect(params.redirectTo ?? "/");
  }

  return <ChooseRoleForm roles={validatedRoles} redirectTo={params.redirectTo} />;
}