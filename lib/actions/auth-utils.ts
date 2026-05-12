
import { BASE_ROLES, type BaseRole } from "@/lib/types/auth";

interface ProfileFragment {
  base_role?:  string | null;
  admin_role?: string | null;
  roles?:      string[] | null;
}

export function isSuperAdmin(p: ProfileFragment | null | undefined): boolean {
  return p?.base_role === "admin" && p?.admin_role === "super_admin";
}

export function isAdmin(p: ProfileFragment | null | undefined): boolean {
  return p?.base_role === "admin";
}

export function resolvePrimaryRole(p: ProfileFragment | null | undefined): BaseRole {
  if (!p) return "parent";
  const b = p.base_role as BaseRole | undefined;
  if (b && (BASE_ROLES as readonly string[]).includes(b)) return b;
  const first = p.roles?.[0] as BaseRole | undefined;
  if (first && (BASE_ROLES as readonly string[]).includes(first)) return first;
  return "parent";
}

export function resolveAllRoles(p: ProfileFragment | null | undefined): BaseRole[] {
  if (!p) return ["parent"];
  const set = new Set<BaseRole>();
  const b = p.base_role as BaseRole | undefined;
  if (b && (BASE_ROLES as readonly string[]).includes(b)) set.add(b);
  for (const r of p.roles ?? []) {
    if ((BASE_ROLES as readonly string[]).includes(r)) set.add(r as BaseRole);
  }
  return set.size > 0 ? [...set] : ["parent"];
}