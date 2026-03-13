import type { UserRole } from "@/lib/types/auth";

/**
 * Returns every role the user holds.
 * Prefers the `roles` array; falls back to the single `role` field.
 */
export function resolveAllRoles(
  profile: {
    role?: string | null;
    roles?: string[] | null;
  } | null,
): UserRole[] {
  if (!profile) return ["parent"];
  if (Array.isArray(profile.roles) && profile.roles.length > 0) {
    return profile.roles as UserRole[];
  }
  return [(profile.role ?? "parent") as UserRole];
}

/**
 * Returns the single "best" role for default redirects.
 * Priority: admin > teacher > parent
 */
export function resolvePrimaryRole(
  profile: {
    role?: string | null;
    roles?: string[] | null;
  } | null,
): UserRole {
  const all = resolveAllRoles(profile);
  const priority: UserRole[] = ["admin", "teacher", "parent"];
  return (priority.find((r) => all.includes(r)) as UserRole) ?? "parent";
}
