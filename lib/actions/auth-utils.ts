import type { UserRole } from "@/lib/types/auth";

const ROLE_PRIORITY: UserRole[] = ["admin", "teacher", "parent"];

/**
 * Returns every role the user holds.
 * Prefers the `roles` array when it has entries; falls back to single `role`.
 * Deduplicates and preserves priority order.
 */
export function resolveAllRoles(
  profile: {
    role?: string | null;
    roles?: string[] | null;
  } | null,
): UserRole[] {
  if (!profile) return ["parent"];

  const fromArray =
    Array.isArray(profile.roles) && profile.roles.length > 0
      ? (profile.roles as UserRole[])
      : null;

  const fromSingle = profile.role ? ([profile.role] as UserRole[]) : ["parent" as UserRole];

  // Merge both sources, deduplicate, sort by priority
  const merged = Array.from(new Set([...(fromArray ?? []), ...fromSingle]));
  return ROLE_PRIORITY.filter((r) => merged.includes(r));
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
  return resolveAllRoles(profile)[0] ?? "parent";
}